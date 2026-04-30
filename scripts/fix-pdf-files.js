const { PrismaClient } = require("@prisma/client");
const { v2: cloudinary } = require("cloudinary");
const https = require("https");

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: "ddr9gl8sj",
  api_key:    "929653439721621",
  api_secret: "ksKwNb47aHCppZJ2bR7euOAfuCs",
});

// URL-dən buffer al (authenticated)
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from("929653439721621:ksKwNb47aHCppZJ2bR7euOAfuCs").toString("base64");
    const req = https.get(url, { headers: { Authorization: "Basic " + auth } }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ buffer: Buffer.concat(chunks), status: res.statusCode, contentType: res.headers["content-type"] }));
    });
    req.on("error", reject);
  });
}

// Cloudinary-ə buffer yüklə
function uploadBuffer(buffer, publicId, format) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id:     publicId,
        access_mode:   "public",
        type:          "upload",
        overwrite:     true,
        // format əlavə etmirik — uzantısız saxlanılsın
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    ).end(buffer);
  });
}

async function main() {
  // Bütün PDF materialları tap
  const materials = await prisma.material.findMany({
    where: { fileType: "PDF" },
    select: { id: true, title: true, fileUrl: true, fileType: true },
  });

  console.log(`Found ${materials.length} PDF materials`);

  for (const mat of materials) {
    console.log(`\nProcessing: ${mat.title}`);
    console.log(`  URL: ${mat.fileUrl}`);

    // URL-i test et
    const testRes = await new Promise((resolve) => {
      https.get(mat.fileUrl, (res) => {
        resolve(res.statusCode);
        res.resume();
      }).on("error", () => resolve(0));
    });

    if (testRes === 200) {
      console.log(`  ✓ Already accessible (${testRes})`);
      continue;
    }

    console.log(`  ✗ Not accessible (${testRes}) — fixing...`);

    // Cloudinary Admin API ilə faylı al
    const match = mat.fileUrl.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) { console.log("  Cannot parse URL"); continue; }

    const publicId = match[1];
    const adminUrl = `https://api.cloudinary.com/v1_1/ddr9gl8sj/resources/raw/upload/${encodeURIComponent(publicId)}`;

    const { buffer, status, contentType } = await fetchBuffer(adminUrl);
    if (status !== 200) {
      console.log(`  Cannot fetch metadata: ${status}`);
      continue;
    }

    const meta = JSON.parse(buffer.toString());
    console.log(`  Metadata OK, bytes: ${meta.bytes}`);

    // Faylı Cloudinary-dən al — authenticated
    const fileAuth = Buffer.from("929653439721621:ksKwNb47aHCppZJ2bR7euOAfuCs").toString("base64");
    const fileRes = await new Promise((resolve, reject) => {
      https.get(meta.secure_url, { headers: { Authorization: "Basic " + fileAuth } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), status: res.statusCode }));
      }).on("error", reject);
    });

    if (fileRes.status !== 200) {
      console.log(`  Cannot download file: ${fileRes.status}`);
      continue;
    }

    // Uzantısız yeni public_id
    const newPublicId = publicId.replace(/\.pdf$/i, "");
    console.log(`  Uploading as: ${newPublicId}`);

    const result = await uploadBuffer(fileRes.buffer, newPublicId);
    console.log(`  Uploaded: ${result.secure_url}`);

    // DB-ni yenilə
    await prisma.material.update({
      where: { id: mat.id },
      data:  { fileUrl: result.secure_url },
    });
    console.log(`  DB updated ✓`);
  }

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
