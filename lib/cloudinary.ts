import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

/**
 * Buffer-i Cloudinary-ə yüklə, URL qaytar
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    filename?: string;
    resource_type?: "image" | "video" | "raw" | "auto";
  } = {}
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder:        options.folder        ?? "muellim-portal",
      public_id:     options.filename,
      resource_type: options.resource_type ?? "auto",
      // Şəkillər üçün avtomatik keyfiyyət optimizasiyası
      transformation: options.resource_type === "image"
        ? [{ quality: "auto", fetch_format: "auto" }]
        : undefined,
    };

    cloudinary.uploader
      .upload_stream(uploadOptions, (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      })
      .end(buffer);
  });
}

/**
 * Cloudinary-dən fayl sil (public_id ilə)
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
