import { z } from "zod";

const MAX_MESSAGE_LENGTH = 2000;

export const createChatRoomSchema = z.object({
  productId: z.string().uuid("ID produk tidak valid"),
});

export const sendMessageSchema = z.object({
  chatRoomId: z.string().uuid("ID chat room tidak valid"),
  messageType: z.enum(["TEXT", "IMAGE"]).default("TEXT"),
  content: z
    .string()
    .trim()
    .min(1, "Pesan tidak boleh kosong")
    .max(MAX_MESSAGE_LENGTH, `Pesan maksimal ${MAX_MESSAGE_LENGTH} karakter`),
  // imageUrl divalidasi terpisah di service setelah upload ke Cloudinary
  // berhasil — endpoint kirim pesan tidak menerima URL gambar sembarangan
  // dari client untuk mencegah orang menaruh link eksternal/berbahaya.
  imageUploadId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});

export const markAsReadSchema = z.object({
  chatRoomId: z.string().uuid("ID chat room tidak valid"),
});

export const listConversationsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const chatHistoryQuerySchema = z.object({
  cursor: z.string().uuid().optional(), // id pesan terlama yang sudah dimuat, untuk infinite scroll ke atas
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type CreateChatRoomInput = z.infer<typeof createChatRoomSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
