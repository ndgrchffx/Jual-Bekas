// Rate limiter untuk event Socket.IO (sliding window sederhana via Redis).
// express-rate-limit tidak bisa dipakai di Socket.IO karena tidak lewat
// HTTP middleware per-request — jadi dibuat implementasi minimal sendiri.

import { redis } from "@/lib/redis";

interface RateLimitOptions {
  windowSeconds: number;
  max: number;
}

// Mengembalikan true jika request DIIZINKAN, false jika melebihi limit.
export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<boolean> {
  const redisKey = `ratelimit:${key}`;
  const current = await redis.incr(redisKey);

  if (current === 1) {
    await redis.expire(redisKey, opts.windowSeconds);
  }

  return current <= opts.max;
}
