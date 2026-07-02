import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAccessToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";
import { UnauthorizedError, ForbiddenError } from "@/utils/errors";

// Augmentasi tipe Express Request agar req.user dikenali TypeScript
// di seluruh controller tanpa perlu cast manual.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

// Membaca access token dari header Authorization: Bearer <token>.
// Tidak membaca dari cookie karena access token memang didesain short-lived
// dan dikirim per-request dari memory client (bukan persistent cookie),
// berbeda dengan refresh token yang disimpan di httpOnly cookie.
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Token akses tidak ditemukan");
    }

    const token = authHeader.slice("Bearer ".length);

    // Cek blacklist: token yang sudah di-logout secara eksplisit ditolak
    // walau secara JWT signature masih valid dan belum expired.
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedError("Sesi telah berakhir, silakan login kembali");
    }

    const payload = verifyAccessToken(token);

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(new UnauthorizedError("Token akses tidak valid atau telah kedaluwarsa"));
  }
}

// Middleware otorisasi berbasis role. Dipakai setelah `authenticate`.
// Contoh: router.delete('/products/:id', authenticate, authorize('ADMIN', 'SELLER'), ...)
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
