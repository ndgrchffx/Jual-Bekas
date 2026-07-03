import type { Request, Response, NextFunction } from "express";
import * as productService from "@/services/product.service";
import { BadRequestError } from "@/utils/errors";

export async function createProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const files = (req.files as Express.Multer.File[]) ?? [];
    const product = await productService.createProduct(req.user.id, req.body, files);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const product = await productService.updateProduct(req.params.id, req.user.id, req.body);
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProductStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const product = await productService.updateProductStatus(
      req.params.id,
      req.user.id,
      req.body.status
    );
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function deleteProductHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const result = await productService.deleteProduct(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function addProductImagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const files = (req.files as Express.Multer.File[]) ?? [];
    const result = await productService.addProductImages(req.params.id, req.user.id, files);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function removeProductImageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    await productService.removeProductImage(req.params.id, req.user.id, req.params.imageId);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getProductDetailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function listMyProductsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new BadRequestError("Tidak terautentikasi");
    const { status, page, limit } = req.query as unknown as {
      status?: "ACTIVE" | "PENDING" | "SOLD" | "REMOVED";
      page: number;
      limit: number;
    };
    const result = await productService.listMyProducts(req.user.id, { status, page, limit });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
