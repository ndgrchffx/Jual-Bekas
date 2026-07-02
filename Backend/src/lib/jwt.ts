// JWT helper.
// Access token: short-lived (15m), dipakai untuk autentikasi tiap request,
//   payload minimal (id, role) supaya verifikasi cepat tanpa query DB.
// Refresh token: long-lived (7d), HANYA dipakai untuk endpoint /auth/refresh,
//   dan disimpan hash-nya tidak diperlukan karena token itu sendiri sudah
//   acak (uuid) dan dicocokkan via lookup di tabel RefreshToken (lihat
//   auth.service.ts untuk rotation logic).

import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";
import type { UserRole } from "@prisma/client";

export interface AccessTokenPayload {
  sub: string; // userId
  role: UserRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    // jsonwebtoken v9 mengetik expiresIn secara ketat (number | StringValue),
    // sedangkan env.JWT_ACCESS_EXPIRES_IN dari Zod ber-tipe string generik.
    // Nilai aktualnya selalu format durasi valid (mis. "15m") sesuai .env.example.
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

// Refresh token tidak menggunakan JWT sign — cukup random string (uuid v4)
// yang disimpan di tabel RefreshToken bersama expiresAt & status revoked.
// Pendekatan ini lebih aman untuk rotation: token lama bisa langsung
// di-invalidate di DB tanpa perlu blacklist JWT yang belum expired.
