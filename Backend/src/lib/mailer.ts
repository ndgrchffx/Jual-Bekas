// Mailer menggunakan nodemailer (SMTP generik, bisa diisi Gmail/SendGrid/dll
// lewat .env). Dipakai untuk email forgot password & notifikasi penting lain.

import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});

export async function sendMail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    // Email gagal terkirim tidak boleh membuat request utama (misal forgot
    // password) melempar 500 ke user — cukup di-log untuk investigasi,
    // karena dari sisi keamanan kita tetap merespons sukses ke client
    // (lihat auth.service.ts: requestPasswordReset).
    logger.error({ err, to, subject }, "Gagal mengirim email");
  }
}

export function buildResetPasswordEmail(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Reset Password</h2>
      <p>Kami menerima permintaan untuk mereset password akun Anda.</p>
      <p>Klik tombol di bawah untuk membuat password baru. Tautan ini berlaku selama 1 jam.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">
        Reset Password
      </a>
      <p style="color:#666;font-size:13px;margin-top:24px;">
        Jika Anda tidak meminta reset password, abaikan email ini.
      </p>
    </div>
  `;
}
