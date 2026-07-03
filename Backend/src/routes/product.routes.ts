import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as productController from "@/controllers/product.controller";
import { authenticate, authorize } from "@/middlewares/auth.middleware";
import { validateBody, validateQuery } from "@/middlewares/validate.middleware";
import { uploadProductImages } from "@/middlewares/upload.middleware";
import { generalLimiter } from "@/middlewares/rateLimit.middleware";
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
} from "@/validators/product.validator";
import { z } from "zod";

const router = Router();

const myProductsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "SOLD", "REMOVED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// PENTING: urutan route di bawah ini disengaja. Express mencocokkan route
// berdasarkan urutan pendaftaran — route statis (/, /me/list) HARUS
// didaftarkan SEBELUM route dinamis (/:slug, /:id), kalau tidak maka
// misalnya GET /products/me/list akan salah tertangkap oleh GET /:slug
// dengan slug = "me".

// --- Khusus SELLER (CRUD produk milik sendiri) ---
router.post(
  "/",
  authenticate,
  authorize(UserRole.SELLER),
  uploadProductImages,
  validateBody(createProductSchema),
  productController.createProductHandler
);

router.get(
  "/me/list",
  authenticate,
  authorize(UserRole.SELLER),
  validateQuery(myProductsQuerySchema),
  productController.listMyProductsHandler
);

// --- Publik (tidak butuh login) ---
router.get("/:slug", productController.getProductDetailHandler);

router.patch(
  "/:id",
  authenticate,
  authorize(UserRole.SELLER),
  validateBody(updateProductSchema),
  productController.updateProductHandler
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(UserRole.SELLER),
  validateBody(updateProductStatusSchema),
  productController.updateProductStatusHandler
);

router.delete(
  "/:id",
  authenticate,
  authorize(UserRole.SELLER),
  productController.deleteProductHandler
);

router.post(
  "/:id/images",
  authenticate,
  authorize(UserRole.SELLER),
  generalLimiter,
  uploadProductImages,
  productController.addProductImagesHandler
);

router.delete(
  "/:id/images/:imageId",
  authenticate,
  authorize(UserRole.SELLER),
  productController.removeProductImageHandler
);

export default router;
