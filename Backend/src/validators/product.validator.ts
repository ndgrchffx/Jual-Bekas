import { z } from "zod";

export const createProductSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Judul minimal 5 karakter")
    .max(150, "Judul maksimal 150 karakter"),
  description: z
    .string()
    .trim()
    .min(20, "Deskripsi minimal 20 karakter")
    .max(5000, "Deskripsi maksimal 5000 karakter"),
  price: z.coerce
    .number()
    .positive("Harga harus lebih dari 0")
    .max(999_999_999, "Harga tidak valid"),
  condition: z.enum(["NEW", "LIKE_NEW", "USED_GOOD", "USED_FAIR"]),
  categoryId: z.string().uuid("Kategori tidak valid"),
  city: z.string().trim().min(2, "Kota wajib diisi").max(100),
  province: z.string().trim().max(100).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const updateProductStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "SOLD", "REMOVED"]),
});

export const reorderProductImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1, "Minimal 1 gambar"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
