import type { Request, Response, NextFunction } from "express";
import * as chatService from "@/services/chat.service";
import { BadRequestError } from "@/utils/errors";

export async function createOrGetRoomHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const room = await chatService.getOrCreateChatRoom(req.user.id, req.body.productId);
    res.status(200).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

export async function listConversationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const { search, page, limit } = req.query as unknown as {
      search?: string;
      page: number;
      limit: number;
    };
    const result = await chatService.listConversations(req.user.id, { search, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getChatHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const { cursor, limit } = req.query as unknown as { cursor?: string; limit: number };
    const messages = await chatService.getChatHistory(
      req.params.roomId,
      req.user.id,
      req.user.role,
      { cursor, limit }
    );
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

export async function markAsReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    await chatService.markMessagesAsRead(req.body.chatRoomId, req.user.id, req.user.role);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}
