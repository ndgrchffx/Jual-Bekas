import { z } from "zod";

// Password policy: minimal 8 karakter, mengandung huruf besar, huruf kecil,
// dan angka. Tidak mewajibkan simbol agar tidak terlalu menyulitkan user,
// tapi cukup kuat untuk mencegah password lemah seperti "12345678".
const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Z]/, "Password harus mengandung huruf besar")
  .regex(/[a-z]/, "Password harus mengandung huruf kecil")
  .regex(/[0-9]/, "Password harus mengandung angka");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .regex(/^08[0-9]{8,11}$/, "Nomor HP tidak valid (contoh: 081234567890)")
    .optional(),
  role: z.enum(["BUYER", "SELLER"]).default("BUYER"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token wajib diisi").optional(),
  // Catatan: refresh token utamanya dibaca dari httpOnly cookie, field ini
  // sebagai fallback untuk klien non-browser (mobile app) yang tidak
  // menyimpan cookie.
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token reset wajib diisi"),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
