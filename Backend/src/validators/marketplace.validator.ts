import { z } from "zod";

export const browseProductsQuerySchema = z.object({
  search: z.string().trim().max(150).optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  condition: z.enum(["NEW", "LIKE_NEW", "USED_GOOD", "USED_FAIR"]).optional(),
  city: z.string().trim().max(100).optional(),
  sellerId: z.string().uuid().optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "most_viewed"])
    .default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const wishlistToggleSchema = z.object({
  productId: z.string().uuid("ID produk tidak valid"),
});

export const followToggleSchema = z.object({
  sellerId: z.string().uuid("ID penjual tidak valid"),
});

export type BrowseProductsQuery = z.infer<typeof browseProductsQuerySchema>;
