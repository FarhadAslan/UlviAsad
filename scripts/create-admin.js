const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Admin@2024!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@ulviasad.az" },
    update: { password: hash, role: "ADMIN", active: true },
    create: {
      name: "Admin",
      email: "admin@ulviasad.az",
      password: hash,
      role: "ADMIN",
      active: true,
    },
  });
  console.log("✅ Admin yaradildi:", admin.email);
  console.log("🔑 Sifre: Admin@2024!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
