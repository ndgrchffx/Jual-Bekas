import type { Request, Response, NextFunction } from "express";
import { env } from "@/config/env";
import * as authService from "@/services/auth.service";
import { BadRequestError } from "@/utils/errors";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
}

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
    const { user, accessToken, refreshToken } = await authService.login(req.body, meta);

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({ success: true, data: { user, accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const tokenFromBody = req.body?.refreshToken;
    const oldToken = tokenFromCookie ?? tokenFromBody;

    if (!oldToken) {
      throw new BadRequestError("Refresh token tidak ditemukan");
    }

    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
    const { accessToken, refreshToken } = await authService.refreshAccessToken(oldToken, meta);

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const tokenFromBody = req.body?.refreshToken;
    const refreshToken = tokenFromCookie ?? tokenFromBody;

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;

    if (refreshToken) {
      await authService.logout(refreshToken, accessToken);
    }

    clearRefreshTokenCookie(res);
    res.status(200).json({ success: true, message: "Logout berhasil" });
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.requestPasswordReset(req.body.email);
    // Pesan generik — lihat catatan di auth.service.ts soal enumeration attack.
    res.status(200).json({
      success: true,
      message: "Jika email terdaftar, tautan reset password telah dikirim.",
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.status(200).json({ success: true, message: "Password berhasil direset." });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    await authService.changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    res.status(200).json({ success: true, message: "Password berhasil diubah." });
  } catch (err) {
    next(err);
  }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const user = await authService.getCurrentUser(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}
