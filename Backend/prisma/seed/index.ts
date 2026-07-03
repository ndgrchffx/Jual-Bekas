// Seed data kategori marketplace.
// Jalankan: npm run prisma:seed
// Aman dijalankan berulang kali (upsert, bukan insert polos).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  {
    name: "Elektronik",
    slug: "elektronik",
    children: [
      { name: "Handphone & Tablet", slug: "handphone-tablet" },
      { name: "Laptop & Komputer", slug: "laptop-komputer" },
      { name: "Kamera & Foto", slug: "kamera-foto" },
      { name: "Audio & Headphone", slug: "audio-headphone" },
      { name: "TV & Monitor", slug: "tv-monitor" },
      { name: "Aksesoris Elektronik", slug: "aksesoris-elektronik" },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    children: [
      { name: "Pakaian Pria", slug: "pakaian-pria" },
      { name: "Pakaian Wanita", slug: "pakaian-wanita" },
      { name: "Sepatu Pria", slug: "sepatu-pria" },
      { name: "Sepatu Wanita", slug: "sepatu-wanita" },
      { name: "Tas & Dompet", slug: "tas-dompet" },
      { name: "Aksesoris Fashion", slug: "aksesoris-fashion" },
    ],
  },
  {
    name: "Rumah & Furnitur",
    slug: "rumah-furnitur",
    children: [
      { name: "Furnitur", slug: "furnitur" },
      { name: "Peralatan Dapur", slug: "peralatan-dapur" },
      { name: "Dekorasi Rumah", slug: "dekorasi-rumah" },
      { name: "Peralatan Rumah Tangga", slug: "peralatan-rumah-tangga" },
    ],
  },
  {
    name: "Kendaraan",
    slug: "kendaraan",
    children: [
      { name: "Mobil", slug: "mobil" },
      { name: "Motor", slug: "motor" },
      { name: "Sepeda", slug: "sepeda" },
      { name: "Aksesoris Kendaraan", slug: "aksesoris-kendaraan" },
    ],
  },
  {
    name: "Olahraga & Hobi",
    slug: "olahraga-hobi",
    children: [
      { name: "Peralatan Olahraga", slug: "peralatan-olahraga" },
      { name: "Alat Musik", slug: "alat-musik" },
      { name: "Koleksi & Mainan", slug: "koleksi-mainan" },
      { name: "Buku & Majalah", slug: "buku-majalah" },
    ],
  },
  {
    name: "Properti",
    slug: "properti",
    children: [
      { name: "Jual Rumah", slug: "jual-rumah" },
      { name: "Sewa Rumah", slug: "sewa-rumah" },
      { name: "Jual Tanah", slug: "jual-tanah" },
      { name: "Jual Kos/Kontrakan", slug: "jual-kos-kontrakan" },
    ],
  },
  {
    name: "Lain-lain",
    slug: "lain-lain",
    children: [
      { name: "Jasa", slug: "jasa" },
      { name: "Barang Antik", slug: "barang-antik" },
      { name: "Hewan Peliharaan", slug: "hewan-peliharaan" },
    ],
  },
];

async function main() {
  console.log("Seeding categories...");

  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { name: cat.name, slug: cat.slug },
    });

    for (const child of cat.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id },
        create: { name: child.name, slug: child.slug, parentId: parent.id },
      });
    }
  }

  console.log(`✅ Seeded ${categories.length} parent categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
