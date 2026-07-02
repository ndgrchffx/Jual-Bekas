import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { generalLimiter } from "@/middlewares/rateLimit.middleware";
import { errorHandler, notFoundHandler } from "@/middlewares/errorHandler.middleware";
import routes from "@/routes/index";

export const app = express();

// --- Security headers ---
app.use(helmet());

// --- CORS: hanya izinkan frontend yang terdaftar, dengan credentials
// (cookie refresh token) diizinkan dikirim cross-origin. ---
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// --- Body & cookie parsing ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser(env.COOKIE_SECRET));

// --- Request logging ---
app.use(pinoHttp({ logger }));

// --- Rate limiting umum (rate limiter khusus auth diterapkan per-route) ---
app.use("/api", generalLimiter);

// --- Health check (untuk Docker healthcheck & load balancer) ---
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- API routes ---
app.use("/api", routes);

// --- 404 & error handler (HARUS paling akhir) ---
app.use(notFoundHandler);
app.use(errorHandler);
