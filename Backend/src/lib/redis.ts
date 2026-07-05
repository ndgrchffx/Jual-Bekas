// Koneksi Redis singleton.
// Dipakai untuk: blacklist access token saat logout, rate limiting,
// dan cache lain (misal kategori, hasil search populer) di modul selanjutnya.

import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Redis connected");
});
