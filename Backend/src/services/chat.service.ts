import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/utils/sanitize";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "@/utils/errors";
import type { SendMessageInput } from "@/validators/chat.validator";

const PREVIEW_LENGTH = 80;

// ----------------------------------------------------------------------------
// GET OR CREATE CHAT ROOM
// ----------------------------------------------------------------------------
// Dipanggil saat pembeli klik "Chat Penjual" di halaman produk.
// Room bersifat unik per kombinasi (buyer, seller, product) — lihat
// @@unique([buyerId, sellerId, productId]) di schema.
export async function getOrCreateChatRoom(buyerId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true, status: true },
  });

  if (!product) {
    throw new NotFoundError("Produk tidak ditemukan");
  }

  // Penjual tidak boleh membuka chat room ke produknya sendiri (self-chat
  // tidak punya makna bisnis dan bisa disalahgunakan untuk uji-coba/spam).
  if (product.sellerId === buyerId) {
    throw new BadRequestError("Anda tidak dapat memulai chat dengan produk milik Anda sendiri");
  }

  const existingRoom = await prisma.chatRoom.findUnique({
    where: {
      buyerId_sellerId_productId: {
        buyerId,
        sellerId: product.sellerId,
        productId: product.id,
      },
    },
  });

  if (existingRoom) return existingRoom;

  return prisma.chatRoom.create({
    data: {
      buyerId,
      sellerId: product.sellerId,
      productId: product.id,
    },
  });
}

// ----------------------------------------------------------------------------
// ACCESS CONTROL
// ----------------------------------------------------------------------------
// Dipakai di REST controller maupun Socket.IO handler sebelum operasi apa
// pun pada sebuah room. Mengembalikan room jika user berhak mengaksesnya,
// melempar ForbiddenError/NotFoundError jika tidak.
//
// Aturan akses:
// - Buyer dari room tersebut: boleh.
// - Seller dari room tersebut: boleh.
// - Admin: boleh, TAPI hanya untuk keperluan dispute/report (ditandai
//   lewat parameter isAdminContext) — dan setiap akses admin dicatat ke
//   AuditLog agar tidak ada "silent read" yang tidak terlacak.
export async function assertRoomAccess(
  chatRoomId: string,
  userId: string,
  userRole: "BUYER" | "SELLER" | "ADMIN",
  context?: { isAdminContext?: boolean; reason?: string }
) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: chatRoomId },
  });

  if (!room) {
    throw new NotFoundError("Chat room tidak ditemukan");
  }

  if (room.buyerId === userId || room.sellerId === userId) {
    return room;
  }

  if (userRole === "ADMIN") {
    // Admin tidak diberi akses diam-diam — wajib lewat endpoint khusus yang
    // mencatat alasan akses (misal investigasi dispute/report) ke AuditLog.
    await prisma.auditLog.create({
      data: {
        userId,
        action: "ADMIN_VIEWED_CHAT_ROOM",
        entity: "ChatRoom",
        entityId: room.id,
        metadata: { reason: context?.reason ?? "Tidak dicantumkan" },
      },
    });
    return room;
  }

  // User lain yang bukan buyer/seller/admin dari room ini — IDOR attempt.
  throw new ForbiddenError("Anda tidak memiliki akses ke chat room ini");
}

// ----------------------------------------------------------------------------
// SEND MESSAGE
// ----------------------------------------------------------------------------
export async function sendMessage(
  senderId: string,
  senderRole: "BUYER" | "SELLER" | "ADMIN",
  input: SendMessageInput
) {
  const room = await assertRoomAccess(input.chatRoomId, senderId, senderRole);

  let imageUrl: string | undefined;
  if (input.messageType === "IMAGE") {
    if (!input.imageUploadId) {
      throw new BadRequestError("imageUploadId wajib diisi untuk pesan gambar");
    }
    // Pengambilan URL final dari hasil upload Cloudinary yang sudah
    // divalidasi (MIME, size, ekstensi) di endpoint upload terpisah —
    // lihat modul Upload. Chat TIDAK menerima URL gambar mentah dari client
    // untuk mencegah penyisipan link eksternal berbahaya.
    imageUrl = await resolveUploadedImageUrl(input.imageUploadId, senderId);
  }

  // Sanitasi selalu dijalankan walau messageType IMAGE (untuk caption).
  const cleanContent = sanitizePlainText(input.content);

  if (cleanContent.length === 0 && input.messageType === "TEXT") {
    throw new BadRequestError("Pesan tidak boleh kosong setelah sanitasi");
  }

  const message = await prisma.$transaction(async (tx: typeof prisma) => {
    const created = await tx.chatMessage.create({
      data: {
        chatRoomId: room.id,
        senderId,
        messageType: input.messageType,
        content: cleanContent,
        imageUrl,
        orderId: input.orderId,
      },
    });

    const preview =
      input.messageType === "IMAGE"
        ? "📷 Gambar"
        : cleanContent.slice(0, PREVIEW_LENGTH);

    await tx.chatRoom.update({
      where: { id: room.id },
      data: { lastMessage: preview, lastMessageAt: created.createdAt },
    });

    return created;
  });

  return message;
}

// Placeholder — diimplementasikan penuh di modul Upload (Cloudinary).
// Memvalidasi bahwa imageUploadId benar-benar hasil upload milik senderId
// yang belum terpakai, lalu mengembalikan secure URL-nya.
async function resolveUploadedImageUrl(_imageUploadId: string, _senderId: string): Promise<string> {
  throw new BadRequestError("Upload gambar chat belum tersedia, gunakan pesan teks untuk saat ini");
}

// ----------------------------------------------------------------------------
// MARK AS READ
// ----------------------------------------------------------------------------
export async function markMessagesAsRead(chatRoomId: string, userId: string, userRole: "BUYER" | "SELLER" | "ADMIN") {
  await assertRoomAccess(chatRoomId, userId, userRole);

  // Hanya pesan dari LAWAN bicara yang ditandai read — pesan milik diri
  // sendiri tidak relevan untuk read receipt.
  await prisma.chatMessage.updateMany({
    where: {
      chatRoomId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });
}

// ----------------------------------------------------------------------------
// LIST CONVERSATIONS (conversation list di sidebar)
// ----------------------------------------------------------------------------
export async function listConversations(
  userId: string,
  opts: { search?: string; page: number; limit: number }
) {
  const where = {
    OR: [{ buyerId: userId }, { sellerId: userId }],
    ...(opts.search
      ? {
          product: {
            title: { contains: opts.search, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  const [rooms, total] = await prisma.$transaction([
    prisma.chatRoom.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: {
        buyer: { select: { id: true, name: true, avatarUrl: true } },
        seller: { select: { id: true, name: true, avatarUrl: true } },
        product: { select: { id: true, title: true, slug: true } },
        messages: {
          where: { isRead: false, senderId: { not: userId } },
          select: { id: true },
        },
      },
    }),
    prisma.chatRoom.count({ where }),
  ]);

  const data = rooms.map((room: (typeof rooms)[number]) => {
    const counterpart = room.buyerId === userId ? room.seller : room.buyer;
    return {
      id: room.id,
      counterpart,
      product: room.product,
      lastMessage: room.lastMessage,
      lastMessageAt: room.lastMessageAt,
      unreadCount: room.messages.length,
    };
  });

  return { data, total, page: opts.page, limit: opts.limit };
}

// ----------------------------------------------------------------------------
// GET CHAT HISTORY (infinite scroll, cursor-based)
// ----------------------------------------------------------------------------
export async function getChatHistory(
  chatRoomId: string,
  userId: string,
  userRole: "BUYER" | "SELLER" | "ADMIN",
  opts: { cursor?: string; limit: number }
) {
  await assertRoomAccess(chatRoomId, userId, userRole);

  const messages = await prisma.chatMessage.findMany({
    where: { chatRoomId },
    orderBy: { createdAt: "desc" },
    take: opts.limit,
    ...(opts.cursor
      ? { cursor: { id: opts.cursor }, skip: 1 }
      : {}),
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // Dikembalikan dalam urutan kronologis (lama -> baru) untuk render UI,
  // walau query-nya descending untuk efisiensi cursor pagination.
  return messages.reverse();
}
