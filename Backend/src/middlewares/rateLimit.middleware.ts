import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

// Rate limiter umum untuk seluruh API.
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Terlalu banyak permintaan, coba lagi nanti." },
});

// Rate limiter lebih ketat khusus endpoint sensitif (login, forgot password,
// register) untuk mencegah brute-force / credential stuffing / spam email.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
  },
});

// Rate limiter untuk endpoint REST chat (create room, history, dll).
// Rate limit untuk EVENT Socket.IO "send_message" diterapkan terpisah
// di sockets/chat.socket.ts karena Socket.IO tidak lewat middleware Express.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan chat, coba lagi sebentar.",
  },
});
