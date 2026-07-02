import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "@/app";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { registerChatSocketHandlers } from "@/sockets/chat.socket";

const httpServer = createServer(app);

// Socket.IO diinisialisasi di sini (server HTTP yang sama dengan Express)
// supaya REST API dan WebSocket berbagi port & lifecycle yang sama.
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});

registerChatSocketHandlers(io);

async function start() {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    httpServer.listen(env.PORT, () => {
      logger.info(`Server berjalan di ${env.APP_URL} (${env.NODE_ENV})`);
    });
  } catch (err) {
    logger.error({ err }, "Gagal start server");
    process.exit(1);
  }
}

start();

// Graceful shutdown — penting agar koneksi DB/Redis ditutup bersih saat
// container di-restart (misal saat deploy baru di Docker/K8s).
async function shutdown(signal: string) {
  logger.info(`${signal} diterima, shutting down...`);
  httpServer.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
