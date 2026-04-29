const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const users = [
  { name: "Anar Həsənov",    email: "anar.hasanov@mail.az" },
  { name: "Günel Əliyeva",   email: "gunel.aliyeva@mail.az" },
  { name: "Rauf Məmmədov",   email: "rauf.mammadov@mail.az" },
  { name: "Nigar Quliyeva",  email: "nigar.quliyeva@mail.az" },
  { name: "Tural İsmayılov", email: "tural.ismayilov@mail.az" },
  { name: "Sevinc Babayeva", email: "sevinc.babayeva@mail.az" },
  { name: "Elçin Nəsirov",   email: "elcin.nasirov@mail.az" },
  { name: "Lalə Hüseynova",  email: "lale.huseynova@mail.az" },
  { name: "Kamran Əhmədov",  email: "kamran.ahmadov@mail.az" },
  { name: "Aysel Rzayeva",   email: "aysel.rzayeva@mail.az" },
];

async function main() {
  const hash = await bcrypt.hash("User@2024!", 10);

  for (const u of users) {
    const created = await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password: hash, role: "USER", active: true },
    });
    console.log(`✅ ${created.name} — ${created.email}`);
  }

  console.log("\n🔑 Şifrə: User@2024!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
