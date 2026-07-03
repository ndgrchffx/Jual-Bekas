import { v4 as uuidv4 } from "uuid";
import { uploadImageBuffer, deleteImage, type UploadResult } from "@/lib/cloudinary";
import { BadRequestError } from "@/utils/errors";

const PRODUCT_IMAGE_FOLDER = "marketplace-escrow/products";

// Upload satu file gambar produk. Nama file SELALU di-generate ulang
// sebagai UUID — nama asli dari user (file.originalname) tidak pernah
// dipakai sebagai bagian dari path/public_id, untuk mencegah:
// - Path traversal lewat nama file yang dimanipulasi
// - Informasi sensitif bocor lewat nama file asli
export async function uploadProductImage(file: Express.Multer.File): Promise<UploadResult> {
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestError("File gambar kosong atau rusak");
  }

  const fileName = uuidv4();

  try {
    return await uploadImageBuffer(file.buffer, PRODUCT_IMAGE_FOLDER, fileName);
  } catch (err) {
    throw new BadRequestError("Gagal mengunggah gambar ke storage. Coba lagi.");
  }
}

export async function uploadMultipleProductImages(
  files: Express.Multer.File[]
): Promise<UploadResult[]> {
  // Upload paralel, tapi jika salah satu gagal, semua yang sudah ke-upload
  // ikut di-rollback (dihapus dari Cloudinary) agar tidak ada gambar
  // "yatim" tanpa referensi di database.
  const results = await Promise.allSettled(files.map(uploadProductImage));

  const succeeded = results.filter(
    (r): r is PromiseFulfilledResult<UploadResult> => r.status === "fulfilled"
  );
  const failed = results.filter((r) => r.status === "rejected");

  if (failed.length > 0) {
    await Promise.all(succeeded.map((r) => deleteImage(r.value.publicId)));
    throw new BadRequestError(
      `${failed.length} dari ${files.length} gambar gagal diunggah. Silakan coba lagi.`
    );
  }

  return succeeded.map((r) => r.value);
}

export async function deleteProductImage(publicId: string): Promise<void> {
  await deleteImage(publicId);
}
