// Socket.IO event handlers untuk realtime chat.
//
// PRINSIP KEAMANAN UTAMA di file ini:
// 1. Identitas user (userId, role) SELALU dari socket.data (hasil verifikasi
//    JWT di handshake — lihat socketAuth.ts), TIDAK PERNAH dari payload
//    event yang dikirim client.
// 2. Setiap event yang menyentuh sebuah room WAJIB lewat assertRoomAccess
//    sebelum melakukan apapun — mencegah IDOR (user A join/kirim pesan ke
//    room milik user B & C).
// 3. Socket.IO room (io.to(roomId)) HANYA boleh di-join setelah access
//    control lolos — client tidak bisa join_room sembarang roomId.

import type { Server as SocketIOServer, Socket } from "socket.io";
import { z } from "zod";
import { socketAuthMiddleware, type AuthenticatedSocketData } from "@/sockets/socketAuth";
import { checkRateLimit } from "@/lib/socketRateLimit";
import * as chatService from "@/services/chat.service";
import { sendMessageSchema } from "@/validators/chat.validator";
import { logger } from "@/lib/logger";

type AuthenticatedSocket = Socket<any, any, any, AuthenticatedSocketData>;
type CallbackFn = (response: { success: boolean; message?: string; data?: unknown }) => void;

const joinRoomSchema = z.object({ chatRoomId: z.string().uuid() });
const typingSchema = z.object({ chatRoomId: z.string().uuid(), isTyping: z.boolean() });
const markAsReadEventSchema = z.object({ chatRoomId: z.string().uuid() });

// Map userId -> Set<socketId> untuk mendukung multi-session (user yang
// login di beberapa device/tab tetap menerima semua event realtime-nya).
const userSocketsMap = new Map<string, Set<string>>();

export function registerChatSocketHandlers(io: SocketIOServer) {
  io.use(socketAuthMiddleware);

  io.on("connection", (socket: AuthenticatedSocket) => {
    const { userId, role } = socket.data;

    // Personal room per-user — dipakai untuk push notifikasi/event yang
    // tidak terikat ke chat room tertentu (lihat modul Notification nanti).
    socket.join(`user:${userId}`);

    if (!userSocketsMap.has(userId)) userSocketsMap.set(userId, new Set());
    userSocketsMap.get(userId)!.add(socket.id);

    logger.debug({ userId, socketId: socket.id }, "Socket connected");

    // ------------------------------------------------------------------
    // join_room — client minta bergabung ke sebuah chat room untuk
    // menerima event realtime (receive_message, user_typing, message_read).
    // ------------------------------------------------------------------
    socket.on("join_room", async (rawPayload: unknown, callback?: CallbackFn) => {
      try {
        const payload = joinRoomSchema.parse(rawPayload);

        // Melempar ForbiddenError/NotFoundError jika user tidak berhak —
        // ini satu-satunya pintu masuk untuk join Socket.IO room, jadi
        // setelah lolos di sini, room tersebut "aman" untuk semua event lain.
        await chatService.assertRoomAccess(payload.chatRoomId, userId, role);

        socket.join(`room:${payload.chatRoomId}`);
        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, message: errMessage(err) });
      }
    });

    socket.on("leave_room", (rawPayload: unknown) => {
      const result = joinRoomSchema.safeParse(rawPayload);
      if (result.success) {
        socket.leave(`room:${result.data.chatRoomId}`);
      }
    });

    // ------------------------------------------------------------------
    // send_message — pesan baru. Disimpan ke DB dulu (source of truth),
    // baru di-broadcast. Kalau gagal simpan, TIDAK ada broadcast palsu.
    // ------------------------------------------------------------------
    socket.on("send_message", async (rawPayload: unknown, callback?: CallbackFn) => {
      try {
        const allowed = await checkRateLimit(`chat:send:${userId}`, {
          windowSeconds: 10,
          max: 15, // maksimal 15 pesan per 10 detik per user — cukup untuk chat normal, ketat untuk spam/flood
        });
        if (!allowed) {
          callback?.({ success: false, message: "Terlalu cepat mengirim pesan, mohon tunggu sebentar." });
          return;
        }

        const payload = sendMessageSchema.parse(rawPayload);
        const message = await chatService.sendMessage(userId, role, payload);

        // Broadcast ke semua socket yang sudah join room ini, TERMASUK
        // pengirim sendiri (supaya UI pengirim juga dapat konfirmasi
        // server-side, bukan optimistic-render lokal yang bisa berbeda
        // dengan data tersimpan, misal setelah sanitasi).
        io.to(`room:${payload.chatRoomId}`).emit("receive_message", message);

        callback?.({ success: true, data: message });
      } catch (err) {
        callback?.({ success: false, message: errMessage(err) });
      }
    });

    // ------------------------------------------------------------------
    // typing — indikator sedang mengetik, tidak disimpan ke DB.
    // ------------------------------------------------------------------
    socket.on("typing", async (rawPayload: unknown) => {
      try {
        const payload = typingSchema.parse(rawPayload);
        await chatService.assertRoomAccess(payload.chatRoomId, userId, role);

        // broadcast ke ANGGOTA LAIN di room (bukan ke diri sendiri)
        socket.to(`room:${payload.chatRoomId}`).emit("user_typing", {
          chatRoomId: payload.chatRoomId,
          userId,
          isTyping: payload.isTyping,
        });
      } catch {
        // Event "typing" bersifat best-effort — kegagalan tidak perlu
        // dikirim balik ke client sebagai error (tidak ada callback).
      }
    });

    // ------------------------------------------------------------------
    // mark_as_read — pesan di room ini sudah dibaca oleh user.
    // ------------------------------------------------------------------
    socket.on("mark_as_read", async (rawPayload: unknown, callback?: CallbackFn) => {
      try {
        const payload = markAsReadEventSchema.parse(rawPayload);
        await chatService.markMessagesAsRead(payload.chatRoomId, userId, role);

        io.to(`room:${payload.chatRoomId}`).emit("message_read", {
          chatRoomId: payload.chatRoomId,
          readByUserId: userId,
          readAt: new Date().toISOString(),
        });

        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, message: errMessage(err) });
      }
    });

    socket.on("disconnect", () => {
      userSocketsMap.get(userId)?.delete(socket.id);
      if (userSocketsMap.get(userId)?.size === 0) {
        userSocketsMap.delete(userId);
      }
      logger.debug({ userId, socketId: socket.id }, "Socket disconnected");
    });
  });
}

// Pesan error yang aman dikirim ke client: tidak membocorkan stack trace /
// detail internal, hanya message yang sudah didesain user-facing dari
// AppError, atau pesan generik untuk error tak terduga.
function errMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.errors[0]?.message ?? "Data tidak valid";
  }
  if (err instanceof Error && "statusCode" in err) {
    return err.message;
  }
  return "Terjadi kesalahan, coba lagi.";
}

// Helper untuk modul lain (misal Notification) yang ingin push event ke
// semua device milik seorang user tanpa peduli room chat.
export function emitToUser(io: SocketIOServer, userId: string, event: string, data: unknown) {
  io.to(`user:${userId}`).emit(event, data);
}
