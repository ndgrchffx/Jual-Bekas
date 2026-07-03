// Konfigurasi & helper Cloudinary.
// Strategi upload: file diterima di server (lewat multer, in-memory buffer),
// divalidasi dulu (MIME, size, ekstensi), baru di-upload ke Cloudinary
// dengan nama file UUID (bukan nama asli dari user) untuk mencegah:
// - Path traversal / collision filename
// - Kebocoran informasi dari nama file asli (misal nama produk sensitif)

import { v2 as cloudinary } from "cloudinary";
import { env } from "@/config/env";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string,
  fileName: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: fileName,
        resource_type: "image",
        // Transformasi otomatis: batasi dimensi maksimal & kompresi kualitas
        // agar tidak ada gambar raksasa yang membengkakkan biaya storage/bandwidth.
        transformation: [
          { width: 1600, height: 1600, crop: "limit" },
          { quality: "auto:good" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Upload Cloudinary gagal tanpa detail error"));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
