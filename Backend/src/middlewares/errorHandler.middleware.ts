import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "@/utils/errors";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";

// Error handler global — HARUS didaftarkan terakhir setelah semua route.
// Menangkap semua error yang dilempar lewat next(err) di seluruh controller.
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, path: req.path }, "Operational error tidak terduga");
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validasi input gagal",
      errors: err.flatten().fieldErrors,
    });
  }

  // Error tak terduga (bug, koneksi DB putus, dll) — log lengkap untuk
  // debugging, tapi jangan bocorkan detail internal ke client di production.
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");

  return res.status(500).json({
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Terjadi kesalahan pada server"
        : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
}
