// Autentikasi Socket.IO di tahap handshake.
// PRINSIP KEAMANAN: client TIDAK PERNAH dipercaya untuk mengklaim siapa
// dirinya (misal lewat payload `userId` di event) — identitas user SELALU
// diturunkan dari access token JWT yang diverifikasi sekali di sini, lalu
// disimpan di socket.data untuk dipakai di semua event handler berikutnya.

import type { Socket } from "socket.io";
import { verifyAccessToken } from "@/lib/jwt";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// Dipakai sebagai generic parameter SocketData saat membuat instance
// Server<...> di server.ts: new SocketIOServer<...,...,...,AuthenticatedSocketData>(...)
// — ini cara resmi Socket.IO untuk mentipekan socket.data, BUKAN lewat
// module augmentation pada interface Socket (yang akan bentrok dengan
// definisi generik SocketData bawaan library).
export interface AuthenticatedSocketData {
  userId: string;
  role: UserRole;
}

type AuthenticatedSocket = Socket<any, any, any, AuthenticatedSocketData>;

export async function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) {
  try {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("UNAUTHORIZED: token tidak ditemukan"));
    }

    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(new Error("UNAUTHORIZED: sesi telah berakhir"));
    }

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new Error("UNAUTHORIZED: akun tidak aktif"));
    }

    socket.data.userId = user.id;
    socket.data.role = user.role;
    next();
  } catch {
    next(new Error("UNAUTHORIZED: token tidak valid"));
  }
}
