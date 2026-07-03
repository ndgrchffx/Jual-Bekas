import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/utils/errors";
import type { BrowseProductsQuery } from "@/validators/marketplace.validator";

// ----------------------------------------------------------------------------
// BROWSE PRODUCTS (search, filter, sort, pagination)
// ----------------------------------------------------------------------------
export async function browseProducts(query: BrowseProductsQuery) {
  if (query.minPrice && query.maxPrice && query.minPrice > query.maxPrice) {
    throw new BadRequestError("Harga minimum tidak boleh lebih besar dari harga maksimum");
  }

  const where = {
    status: "ACTIVE" as const,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            { description: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.condition ? { condition: query.condition } : {}),
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" as const } } : {}),
    ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    ...(query.minPrice || query.maxPrice
      ? {
          price: {
            ...(query.minPrice ? { gte: query.minPrice } : {}),
            ...(query.maxPrice ? { lte: query.maxPrice } : {}),
          },
        }
      : {}),
  };

  const orderBy = resolveSortOrder(query.sort);

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { id: true, name: true, city: true, ratingAverage: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data: products,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

function resolveSortOrder(sort: BrowseProductsQuery["sort"]) {
  switch (sort) {
    case "price_asc":
      return { price: "asc" as const };
    case "price_desc":
      return { price: "desc" as const };
    case "most_viewed":
      return { viewCount: "desc" as const };
    case "newest":
    default:
      return { createdAt: "desc" as const };
  }
}

// ----------------------------------------------------------------------------
// WISHLIST
// ----------------------------------------------------------------------------
export async function toggleWishlist(userId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true },
  });
  if (!product || product.status === "REMOVED") {
    throw new NotFoundError("Produk tidak ditemukan");
  }

  const existing = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existing) {
    await prisma.wishlist.delete({ where: { id: existing.id } });
    return { wishlisted: false };
  }

  await prisma.wishlist.create({ data: { userId, productId } });
  return { wishlisted: true };
}

export async function listMyWishlist(userId: string, opts: { page: number; limit: number }) {
  const where = { userId };

  const [items, total] = await prisma.$transaction([
    prisma.wishlist.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: {
        product: {
          include: {
            images: { orderBy: { position: "asc" }, take: 1 },
            seller: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.wishlist.count({ where }),
  ]);

  return { data: items.map((i) => i.product), total, page: opts.page, limit: opts.limit };
}

// ----------------------------------------------------------------------------
// FOLLOW SELLER
// ----------------------------------------------------------------------------
export async function toggleFollowSeller(followerId: string, sellerId: string) {
  if (followerId === sellerId) {
    throw new BadRequestError("Anda tidak dapat follow diri sendiri");
  }

  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { id: true, role: true },
  });
  if (!seller) throw new NotFoundError("Penjual tidak ditemukan");

  const existing = await prisma.follow.findUnique({
    where: { followerId_sellerId: { followerId, sellerId } },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    return { following: false };
  }

  await prisma.follow.create({ data: { followerId, sellerId } });
  return { following: true };
}

// ----------------------------------------------------------------------------
// CATEGORY LIST (untuk filter dropdown)
// ----------------------------------------------------------------------------
export async function listCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    include: {
      children: { orderBy: { name: "asc" } },
    },
  });
}
