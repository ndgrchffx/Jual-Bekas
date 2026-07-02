// Sanitasi input teks bebas (chat, deskripsi produk, review, dll) untuk
// mencegah Stored XSS. Strategi: strip SELURUH tag HTML — chat & deskripsi
// produk di marketplace ini tidak butuh rich text/HTML, jadi pendekatan
// paling aman adalah tidak mengizinkan tag apapun sama sekali, bukan
// whitelist tag tertentu yang rawan bypass.

import sanitizeHtml from "sanitize-html";

export function sanitizePlainText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    // disallowedTagsMode "discard" (default) sudah cukup, tapi text-only
    // content tetap di-keep sehingga "<script>alert(1)</script>" jadi
    // "alert(1)" — bukan dihapus total — supaya pengguna paham mengapa
    // tampilannya berubah daripada pesan tiba-tiba kosong.
  }).trim();
}
