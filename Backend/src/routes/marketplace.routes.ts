import { Router } from "express";
import * as marketplaceController from "@/controllers/marketplace.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { validateBody, validateQuery } from "@/middlewares/validate.middleware";
import {
  browseProductsQuerySchema,
  wishlistToggleSchema,
  followToggleSchema,
} from "@/validators/marketplace.validator";
import { z } from "zod";

const router = Router();

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// --- Publik ---
router.get("/products", validateQuery(browseProductsQuerySchema), marketplaceController.browseProductsHandler);
router.get("/categories", marketplaceController.listCategoriesHandler);

// --- Wajib login ---
router.post("/wishlist", authenticate, validateBody(wishlistToggleSchema), marketplaceController.toggleWishlistHandler);
router.get("/wishlist", authenticate, validateQuery(paginationQuerySchema), marketplaceController.listMyWishlistHandler);
router.post("/follow", authenticate, validateBody(followToggleSchema), marketplaceController.toggleFollowHandler);

export default router;
