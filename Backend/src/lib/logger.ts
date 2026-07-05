// Structured logger menggunakan pino.
// Dipakai di seluruh layer (service, middleware, jobs) agar log konsisten
// dan mudah dicari di production (misal lewat log aggregator).

import pino from "pino";
import { env } from "@/config/env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        }
      : undefined,
});
