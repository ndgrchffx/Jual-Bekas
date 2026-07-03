import type { Request, Response, NextFunction } from "express";
import * as marketplaceService from "@/services/marketplace.service";
import { BadRequestError } from "@/utils/errors";

export async function browseProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await marketplaceService.browseProducts(req.query as any);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function toggleWishlistHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const result = await marketplaceService.toggleWishlist(req.user.id, req.body.productId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listMyWishlistHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await marketplaceService.listMyWishlist(req.user.id, { page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function toggleFollowHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const result = await marketplaceService.toggleFollowSeller(req.user.id, req.body.sellerId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listCategoriesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await marketplaceService.listCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}
