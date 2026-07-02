import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as chatController from "@/controllers/chat.controller";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { validateBody, validateQuery } from "@/middlewares/validate.middleware";
import { chatLimiter } from "@/middlewares/rateLimit.middleware";
import {
  createChatRoomSchema,
  markAsReadSchema,
  listConversationsQuerySchema,
  chatHistoryQuerySchema,
} from "@/validators/chat.validator";

const router = Router();

// Semua route chat wajib login. BUYER & SELLER bisa pakai semua endpoint
// di bawah (akses ke room spesifik tetap dicek per-room di service layer
// lewat assertRoomAccess — authorize() di sini hanya soal role secara umum).
router.use(authenticate, authorize(UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN));

router.post(
  "/rooms",
  chatLimiter,
  validateBody(createChatRoomSchema),
  chatController.createOrGetRoomHandler
);

router.get(
  "/conversations",
  validateQuery(listConversationsQuerySchema),
  chatController.listConversationsHandler
);

router.get(
  "/rooms/:roomId/messages",
  validateQuery(chatHistoryQuerySchema),
  chatController.getChatHistoryHandler
);

router.post(
  "/mark-as-read",
  validateBody(markAsReadSchema),
  chatController.markAsReadHandler
);

// Catatan: endpoint kirim pesan TIDAK ada di REST — pengiriman pesan utama
// terjadi lewat Socket.IO event "send_message" (lihat src/sockets/chat.socket.ts)
// agar realtime delivery & persist DB terjadi dalam satu alur yang konsisten.

export default router;
