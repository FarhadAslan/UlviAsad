const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    select: { id: true, title: true, fileUrl: true, fileType: true, active: true },
    take: 10,
  });
  console.log("Materials:", JSON.stringify(materials, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
