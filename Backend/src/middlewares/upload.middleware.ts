// Middleware upload file (foto produk) menggunakan multer.
// Strategi: memoryStorage (bukan diskStorage) — file tidak pernah disimpan
// ke filesystem server, langsung di-stream ke Cloudinary dari buffer di
// memory. Ini menghindari risiko file sisa di server & lebih cocok untuk
// deployment stateless (container yang bisa di-restart kapan saja).

import multer from "multer";
import type { Request } from "express";
import { BadRequestError } from "@/utils/errors";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per foto
const MAX_FILES_PER_PRODUCT = 8;

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) {
  const extension = getExtension(file.originalname);

  // Validasi MIME type DAN ekstensi sekaligus — keduanya harus konsisten.
  // Hanya cek salah satu (misal MIME saja) bisa dibypass dengan memalsukan
  // header Content-Type sementara ekstensi file tetap berbahaya (mis. .php).
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestError(
        `Tipe file ${file.mimetype} tidak diizinkan. Hanya JPG, PNG, atau WEBP.`
      )
    );
  }

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return callback(
      new BadRequestError(`Ekstensi file ${extension} tidak diizinkan.`)
    );
  }

  callback(null, true);
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot).toLowerCase();
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_PRODUCT,
  },
});

export const uploadProductImages = upload.array("images", MAX_FILES_PER_PRODUCT);
export const uploadSingleImage = upload.single("image");

export { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_PRODUCT, ALLOWED_MIME_TYPES };
