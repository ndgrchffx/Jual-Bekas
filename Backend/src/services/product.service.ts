import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/utils/sanitize";
import { slugify } from "@/utils/token";
import { uploadMultipleProductImages, deleteProductImage } from "@/services/upload.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/utils/errors";
import type { CreateProductInput, UpdateProductInput } from "@/validators/product.validator";

const MAX_IMAGES_PER_PRODUCT = 8;

// ----------------------------------------------------------------------------
// SLUG GENERATION (unik, dengan suffix random jika collision)
// ----------------------------------------------------------------------------
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  let attempt = 0;

  while (await prisma.product.findUnique({ where: { slug: candidate } })) {
    attempt += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (attempt > 5) {
      // Sangat tidak mungkin terjadi (kombinasi 4 karakter random),
      // tapi tetap dibatasi agar tidak infinite loop dalam skenario ekstrem.
      candidate = `${base}-${Date.now()}`;
      break;
    }
  }

  return candidate;
}

// ----------------------------------------------------------------------------
// CREATE PRODUCT
// ----------------------------------------------------------------------------
export async function createProduct(
  sellerId: string,
  input: CreateProductInput,
  files: Express.Multer.File[]
) {
  if (files.length === 0) {
    throw new BadRequestError("Minimal 1 foto produk wajib diunggah");
  }
  if (files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new BadRequestError(`Maksimal ${MAX_IMAGES_PER_PRODUCT} foto per produk`);
  }

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new BadRequestError("Kategori tidak ditemukan");
  }

  const slug = await generateUniqueSlug(input.title);

  // Upload ke Cloudinary DULU, baru simpan ke DB. Jika DB insert gagal
  // setelah upload sukses, gambar yang sudah ter-upload di-rollback —
  // urutan ini menghindari data Product tanpa gambar yang valid.
  const uploaded = await uploadMultipleProductImages(files);

  try {
    const product = await prisma.product.create({
      data: {
        sellerId,
        categoryId: input.categoryId,
        title: input.title,
        slug,
        description: sanitizePlainText(input.description),
        price: input.price,
        condition: input.condition,
        city: input.city,
        province: input.province,
        latitude: input.latitude,
        longitude: input.longitude,
        images: {
          create: uploaded.map((img, index) => ({
            url: img.url,
            publicId: img.publicId,
            position: index,
          })),
        },
      },
      include: { images: true, category: true },
    });

    return product;
  } catch (err) {
    // Rollback gambar yang sudah ter-upload jika penyimpanan ke DB gagal.
    await Promise.all(uploaded.map((img) => deleteProductImage(img.publicId)));
    throw err;
  }
}

// ----------------------------------------------------------------------------
// OWNERSHIP CHECK
// ----------------------------------------------------------------------------
async function assertProductOwnership(productId: string, sellerId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Produk tidak ditemukan");
  if (product.sellerId !== sellerId) {
    throw new ForbiddenError("Anda tidak memiliki akses untuk mengubah produk ini");
  }
  return product;
}

// ----------------------------------------------------------------------------
// UPDATE PRODUCT
// ----------------------------------------------------------------------------
export async function updateProduct(
  productId: string,
  sellerId: string,
  input: UpdateProductInput
) {
  const existing = await assertProductOwnership(productId, sellerId);

  // Produk yang sudah SOLD tidak boleh diedit (mencegah penjual mengubah
  // harga/deskripsi setelah transaksi selesai — data historis order tetap
  // memakai snapshot di OrderItem, tapi produk itu sendiri seharusnya beku).
  if (existing.status === "SOLD") {
    throw new BadRequestError("Produk yang sudah terjual tidak dapat diedit");
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new BadRequestError("Kategori tidak ditemukan");
  }

  const data: Record<string, unknown> = { ...input };
  if (input.description) {
    data.description = sanitizePlainText(input.description);
  }
  if (input.title && input.title !== existing.title) {
    data.slug = await generateUniqueSlug(input.title);
  }

  return prisma.product.update({
    where: { id: productId },
    data,
    include: { images: true, category: true },
  });
}

// ----------------------------------------------------------------------------
// UPDATE STATUS (Aktif / Pending / Terjual / Removed)
// ----------------------------------------------------------------------------
export async function updateProductStatus(
  productId: string,
  sellerId: string,
  status: "ACTIVE" | "PENDING" | "SOLD" | "REMOVED"
) {
  await assertProductOwnership(productId, sellerId);

  // SOLD tidak boleh diubah manual oleh penjual — status ini HANYA boleh
  // diubah otomatis oleh sistem saat escrow RELEASED (lihat modul Order),
  // supaya status produk selalu konsisten dengan status transaksi nyata.
  if (status === "SOLD") {
    throw new ForbiddenError(
      "Status SOLD hanya dapat diubah otomatis oleh sistem setelah transaksi selesai"
    );
  }

  return prisma.product.update({
    where: { id: productId },
    data: { status },
  });
}

// ----------------------------------------------------------------------------
// DELETE PRODUCT (soft — set status REMOVED, gambar tetap di Cloudinary
// untuk audit, kecuali dihapus eksplisit oleh admin)
// ----------------------------------------------------------------------------
export async function deleteProduct(productId: string, sellerId: string) {
  const existing = await assertProductOwnership(productId, sellerId);

  if (existing.status === "SOLD") {
    throw new BadRequestError("Produk yang sudah terjual tidak dapat dihapus");
  }

  // Cek apakah produk pernah dipakai di order (walau belum SOLD, misal
  // order PENDING_PAYMENT) — jika ya, jangan hard delete demi integritas
  // riwayat transaksi; cukup soft-delete (REMOVED).
  const hasOrderHistory = await prisma.orderItem.findFirst({
    where: { productId },
    select: { id: true },
  });

  if (hasOrderHistory) {
    return prisma.product.update({
      where: { id: productId },
      data: { status: "REMOVED" },
    });
  }

  // Belum pernah ada transaksi sama sekali — aman untuk hard delete +
  // hapus gambar dari Cloudinary sekalian (tidak ada yang mereferensikannya).
  const images = await prisma.productImage.findMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
  await Promise.all(images.map((img) => deleteProductImage(img.publicId)));

  return { id: productId, deleted: true };
}

// ----------------------------------------------------------------------------
// ADD / REMOVE IMAGES (edit foto produk yang sudah ada)
// ----------------------------------------------------------------------------
export async function addProductImages(
  productId: string,
  sellerId: string,
  files: Express.Multer.File[]
) {
  const existing = await assertProductOwnership(productId, sellerId);

  const currentCount = await prisma.productImage.count({ where: { productId } });
  if (currentCount + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new BadRequestError(
      `Total foto tidak boleh melebihi ${MAX_IMAGES_PER_PRODUCT}. Saat ini sudah ada ${currentCount}.`
    );
  }

  const uploaded = await uploadMultipleProductImages(files);

  const created = await prisma.productImage.createMany({
    data: uploaded.map((img, index) => ({
      productId: existing.id,
      url: img.url,
      publicId: img.publicId,
      position: currentCount + index,
    })),
  });

  return created;
}

export async function removeProductImage(productId: string, sellerId: string, imageId: string) {
  await assertProductOwnership(productId, sellerId);

  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== productId) {
    throw new NotFoundError("Gambar tidak ditemukan");
  }

  const remainingCount = await prisma.productImage.count({ where: { productId } });
  if (remainingCount <= 1) {
    throw new BadRequestError("Produk wajib memiliki minimal 1 foto");
  }

  await prisma.productImage.delete({ where: { id: imageId } });
  await deleteProductImage(image.publicId);
}

// ----------------------------------------------------------------------------
// GET PRODUCT DETAIL (publik, increment viewCount)
// ----------------------------------------------------------------------------
export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      category: true,
      seller: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          city: true,
          ratingAverage: true,
          ratingCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!product || product.status === "REMOVED") {
    throw new NotFoundError("Produk tidak ditemukan");
  }

  // Increment viewCount secara async tanpa diawait — tidak boleh
  // memperlambat response detail produk hanya untuk update statistik.
  prisma.product
    .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {
      // Kegagalan increment viewCount tidak kritikal, cukup diabaikan.
    });

  return product;
}

// ----------------------------------------------------------------------------
// LIST PRODUK MILIK SELLER (dashboard penjual — termasuk yang PENDING/REMOVED)
// ----------------------------------------------------------------------------
export async function listMyProducts(
  sellerId: string,
  opts: { status?: "ACTIVE" | "PENDING" | "SOLD" | "REMOVED"; page: number; limit: number }
) {
  const where = { sellerId, ...(opts.status ? { status: opts.status } : {}) };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: { images: { orderBy: { position: "asc" }, take: 1 }, category: true },
    }),
    prisma.product.count({ where }),
  ]);

  return { data: products, total, page: opts.page, limit: opts.limit };
}
