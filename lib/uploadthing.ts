import { createUploadthing, type FileRouter } from "uploadthing/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

const FILE_TYPE_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "text/plain": "TXT",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/ogg": "VIDEO",
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/gif": "IMAGE",
  "image/webp": "IMAGE",
};

export const ourFileRouter = {
  // Material yükləmə — yalnız ADMIN
  materialUploader: f({
    pdf:   { maxFileSize: "512MB", maxFileCount: 1 },
    video: { maxFileSize: "512MB", maxFileCount: 1 },
    image: { maxFileSize: "512MB", maxFileCount: 1 },
    "application/msword":                                                                    { maxFileSize: "512MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":               { maxFileSize: "512MB", maxFileCount: 1 },
    "application/vnd.ms-powerpoint":                                                         { maxFileSize: "512MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":             { maxFileSize: "512MB", maxFileCount: 1 },
    "text/plain":                                                                             { maxFileSize: "512MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      const role    = (session?.user as any)?.role;
      if (!session || (role !== "ADMIN" && role !== "TEACHER")) {
        throw new Error("İcazə yoxdur");
      }
      return { userId: (session.user as any).id, role };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const fileType = FILE_TYPE_MAP[file.type] ?? "FILE";
      return { url: file.ufsUrl, fileType, fileName: file.name, size: file.size };
    }),

  // Quiz şəkli yükləmə — ADMIN və TEACHER
  quizImageUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      const role    = (session?.user as any)?.role;
      if (!session || (role !== "ADMIN" && role !== "TEACHER")) {
        throw new Error("İcazə yoxdur");
      }
      return { userId: (session.user as any).id };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, fileType: "IMAGE", fileName: file.name, size: file.size };
    }),

  // Məqalə şəkli — yalnız ADMIN
  articleImageUploader: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      if (!session || (session.user as any)?.role !== "ADMIN") {
        throw new Error("İcazə yoxdur");
      }
      return { userId: (session.user as any).id };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, fileType: "IMAGE", fileName: file.name, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
