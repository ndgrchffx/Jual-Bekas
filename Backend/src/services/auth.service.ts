import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { hashPassword, comparePassword } from "@/utils/password";
import { generateSecureToken } from "@/utils/token";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";
import { sendMail, buildResetPasswordEmail } from "@/lib/mailer";
import { env } from "@/config/env";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} from "@/utils/errors";
import type { RegisterInput, LoginInput } from "@/validators/auth.validator";

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 jam

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// ----------------------------------------------------------------------------
// REGISTER
// ----------------------------------------------------------------------------
export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new ConflictError("Email sudah terdaftar");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
      role: input.role,
      // Setiap user (termasuk BUYER) dibuatkan Wallet kosong sejak awal,
      // karena seorang buyer bisa saja kemudian menjual barang juga —
      // satu User tidak dipisah jadi entitas Buyer/Seller berbeda.
      wallet: { create: { balance: 0 } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      createdAt: true,
    },
  });

  return user;
}

// ----------------------------------------------------------------------------
// LOGIN
// ----------------------------------------------------------------------------
export async function login(input: LoginInput, meta: RequestMeta) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.passwordHash) {
    // Pesan generik (tidak membedakan "email tidak ada" vs "password salah")
    // untuk mencegah enumerasi email oleh penyerang.
    throw new UnauthorizedError("Email atau password salah");
  }

  if (user.status === "SUSPENDED") {
    throw new UnauthorizedError("Akun Anda sedang disuspend. Hubungi admin.");
  }
  if (user.status === "BANNED") {
    throw new UnauthorizedError("Akun Anda telah diban.");
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError("Email atau password salah");
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id, meta);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_LOGIN",
      entity: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
    },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    accessToken,
    refreshToken,
  };
}

// ----------------------------------------------------------------------------
// REFRESH TOKEN ROTATION
// ----------------------------------------------------------------------------
// Setiap kali refresh token dipakai, token lama langsung di-revoke dan
// token baru diterbitkan ("rotation"). Ini mencegah replay attack: kalau
// refresh token dicuri lalu dipakai penyerang, token itu langsung invalid
// setelah pemilik asli menggunakannya — dan kita bisa deteksi reuse.
export async function refreshAccessToken(
  oldRefreshToken: string,
  meta: RequestMeta
) {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new UnauthorizedError("Refresh token tidak valid");
  }

  // Deteksi token reuse: token yang sudah di-revoke tapi dipakai lagi
  // mengindikasikan kemungkinan refresh token dicuri. Sebagai langkah aman,
  // revoke seluruh refresh token milik user ini agar sesi yang dicuri
  // langsung terputus juga.
  if (tokenRecord.revoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: tokenRecord.userId, revoked: false },
      data: { revoked: true },
    });
    throw new UnauthorizedError(
      "Sesi terdeteksi tidak valid. Silakan login kembali."
    );
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token telah kedaluwarsa");
  }

  const user = tokenRecord.user;
  if (user.status !== "ACTIVE") {
    throw new UnauthorizedError("Akun Anda tidak aktif");
  }

  // Rotation: revoke token lama, buat token baru, simpan rantai (replacedByToken)
  const newRefreshToken = generateSecureToken();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true, replacedByToken: newRefreshToken },
    }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    }),
  ]);

  const accessToken = signAccessToken({ sub: user.id, role: user.role });

  return { accessToken, refreshToken: newRefreshToken };
}

async function issueRefreshToken(userId: string, meta: RequestMeta) {
  const token = generateSecureToken();
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  return token;
}

// ----------------------------------------------------------------------------
// LOGOUT
// ----------------------------------------------------------------------------
export async function logout(refreshToken: string, accessToken?: string) {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revoked: false },
    data: { revoked: true },
  });

  // Blacklist access token yang masih aktif di Redis sampai expiry aslinya,
  // supaya token itu tidak bisa dipakai lagi walau belum expired secara JWT.
  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      const remainingTtlSeconds = payload ? 15 * 60 : 0; // sesuai JWT_ACCESS_EXPIRES_IN
      await redis.set(`blacklist:${accessToken}`, "1", "EX", remainingTtlSeconds);
    } catch {
      // Token sudah invalid/expired — tidak perlu di-blacklist lagi.
    }
  }
}

// ----------------------------------------------------------------------------
// FORGOT PASSWORD
// ----------------------------------------------------------------------------
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Selalu merespons "berhasil" terlepas user ditemukan atau tidak, untuk
  // mencegah penyerang mengetahui email mana yang terdaftar di sistem
  // (enumeration attack). Pengiriman email hanya terjadi jika user ada.
  if (!user) return;

  const token = generateSecureToken(32);
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
    },
  });

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await sendMail(user.email, "Reset Password - Marketplace Escrow", buildResetPasswordEmail(resetUrl));
}

export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.used) {
    throw new BadRequestError("Token reset tidak valid");
  }
  if (resetToken.expiresAt < new Date()) {
    throw new BadRequestError("Token reset telah kedaluwarsa");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    }),
    // Setelah reset password, semua refresh token aktif di-revoke —
    // memaksa semua sesi lama (termasuk milik penyerang jika akun diretas)
    // untuk login ulang dengan password baru.
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revoked: false },
      data: { revoked: true },
    }),
  ]);
}

// ----------------------------------------------------------------------------
// CHANGE PASSWORD (saat user sudah login)
// ----------------------------------------------------------------------------
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    throw new NotFoundError("User tidak ditemukan");
  }

  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new BadRequestError("Password saat ini salah");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatarUrl: true,
      ratingAverage: true,
      ratingCount: true,
      createdAt: true,
    },
  });

  if (!user) throw new NotFoundError("User tidak ditemukan");
  return user;
}
