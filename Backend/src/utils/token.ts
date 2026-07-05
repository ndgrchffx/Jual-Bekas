import { randomBytes } from "crypto";

// Token acak untuk refresh token & password reset.
// Menggunakan crypto.randomBytes (bukan uuid biasa) karena ini token
// keamanan yang harus unpredictable secara kriptografis.
export function generateSecureToken(byteLength = 48): string {
  return randomBytes(byteLength).toString("hex");
}

export function generateOrderNumber(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `ORD-${yyyy}${mm}${dd}-${random}`;
}

// Slug dasar dari judul produk (lowercase, spasi -> dash, strip karakter
// non-alfanumerik). Keunikan slug dijamin di service layer dengan
// menambahkan suffix random jika terjadi collision — BUKAN di sini, karena
// fungsi ini murni tanpa akses database.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
