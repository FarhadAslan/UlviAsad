import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@muellim.az" },
    update: {},
    create: {
      name: "Admin İstifadəçi",
      email: "admin@muellim.az",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // Student user
  const studentPassword = await bcrypt.hash("student123", 10);
  const student = await prisma.user.upsert({
    where: { email: "telebe@muellim.az" },
    update: {},
    create: {
      name: "Tələbə İstifadəçi",
      email: "telebe@muellim.az",
      password: studentPassword,
      role: "STUDENT",
    },
  });

  // Regular user
  const userPassword = await bcrypt.hash("user123", 10);
  await prisma.user.upsert({
    where: { email: "user@muellim.az" },
    update: {},
    create: {
      name: "Adi İstifadəçi",
      email: "user@muellim.az",
      password: userPassword,
      role: "USER",
    },
  });

  // Sample Quiz 1
  const quiz1 = await prisma.quiz.create({
    data: {
      title: "Azərbaycan Konstitusiyası",
      category: "QANUNVERICILIK",
      type: "SINAQ",
      duration: 10,
      visibility: "PUBLIC",
      questions: {
        create: [
          {
            text: "Azərbaycan Respublikasının Konstitusiyası neçənci ildə qəbul edilib?",
            options: JSON.stringify([
              { label: "A", text: "1991" },
              { label: "B", text: "1995" },
              { label: "C", text: "1993" },
              { label: "D", text: "2000" },
            ]),
            correctOption: "B",
            order: 1,
          },
          {
            text: "Azərbaycan Respublikasının paytaxtı hansı şəhərdir?",
            options: JSON.stringify([
              { label: "A", text: "Gəncə" },
              { label: "B", text: "Sumqayıt" },
              { label: "C", text: "Bakı" },
              { label: "D", text: "Lənkəran" },
            ]),
            correctOption: "C",
            order: 2,
          },
          {
            text: "Azərbaycan Respublikasının dövlət dili hansıdır?",
            options: JSON.stringify([
              { label: "A", text: "Rus dili" },
              { label: "B", text: "Azərbaycan dili" },
              { label: "C", text: "İngilis dili" },
              { label: "D", text: "Türk dili" },
            ]),
            correctOption: "B",
            order: 3,
          },
        ],
      },
    },
  });

  // Sample Quiz 2
  const quiz2 = await prisma.quiz.create({
    data: {
      title: "Məntiq Testi - Əsas Səviyyə",
      category: "MANTIQ",
      type: "TEST",
      visibility: "PUBLIC",
      questions: {
        create: [
          {
            text: "5, 10, 15, 20, ... — növbəti ədəd nədir?",
            options: JSON.stringify([
              { label: "A", text: "22" },
              { label: "B", text: "25" },
              { label: "C", text: "30" },
              { label: "D", text: "24" },
            ]),
            correctOption: "B",
            order: 1,
          },
          {
            text: "Bütün itlər heyvandır. Bəzi heyvanlar vəhşidir. Bu məntiqdən nə çıxır?",
            options: JSON.stringify([
              { label: "A", text: "Bütün itlər vəhşidir" },
              { label: "B", text: "Bəzi itlər vəhşi ola bilər" },
              { label: "C", text: "Heç bir it vəhşi deyil" },
              { label: "D", text: "Bütün heyvanlar itdir" },
            ]),
            correctOption: "B",
            order: 2,
          },
        ],
      },
    },
  });

  // Sample Quiz 3 - Student only
  await prisma.quiz.create({
    data: {
      title: "İnformatika - Proqramlaşdırma Əsasları",
      category: "INFORMATIKA",
      type: "SINAQ",
      duration: 15,
      visibility: "STUDENT_ONLY",
      questions: {
        create: [
          {
            text: "HTML-in tam adı nədir?",
            options: JSON.stringify([
              { label: "A", text: "Hyper Text Markup Language" },
              { label: "B", text: "High Tech Modern Language" },
              { label: "C", text: "Hyper Transfer Markup Language" },
              { label: "D", text: "Home Tool Markup Language" },
            ]),
            correctOption: "A",
            order: 1,
          },
          {
            text: "CSS nəyin abbreviaturasıdır?",
            options: JSON.stringify([
              { label: "A", text: "Computer Style Sheets" },
              { label: "B", text: "Cascading Style Sheets" },
              { label: "C", text: "Creative Style System" },
              { label: "D", text: "Colorful Style Sheets" },
            ]),
            correctOption: "B",
            order: 2,
          },
        ],
      },
    },
  });

  // Sample Quiz 4
  await prisma.quiz.create({
    data: {
      title: "Azərbaycan Dili - Orfoqrafiya",
      category: "AZERBAYCAN_DILI",
      type: "TEST",
      visibility: "PUBLIC",
      questions: {
        create: [
          {
            text: "Hansı söz düzgün yazılıb?",
            options: JSON.stringify([
              { label: "A", text: "müəllim" },
              { label: "B", text: "muellim" },
              { label: "C", text: "müəllım" },
              { label: "D", text: "muəllim" },
            ]),
            correctOption: "A",
            order: 1,
          },
          {
            text: "\"Kitab\" sözünün cəmi necə yazılır?",
            options: JSON.stringify([
              { label: "A", text: "kitablar" },
              { label: "B", text: "kitablar" },
              { label: "C", text: "kitablar" },
              { label: "D", text: "kitablar" },
            ]),
            correctOption: "A",
            order: 2,
          },
        ],
      },
    },
  });

  // Sample Materials
  await prisma.material.createMany({
    data: [
      {
        title: "Azərbaycan Konstitusiyası - Tam Mətn",
        category: "QANUNVERICILIK",
        fileUrl: "/materials/konstitusiya.pdf",
        fileType: "PDF",
        visibility: "PUBLIC",
      },
      {
        title: "Məntiq Məsələləri Toplusu",
        category: "MANTIQ",
        fileUrl: "/materials/mantiq.pdf",
        fileType: "PDF",
        visibility: "PUBLIC",
      },
      {
        title: "Azərbaycan Dili Qrammatikası",
        category: "AZERBAYCAN_DILI",
        fileUrl: "/materials/qrammatika.pdf",
        fileType: "PDF",
        visibility: "STUDENT_ONLY",
      },
      {
        title: "İnformatika Dərsliyi",
        category: "INFORMATIKA",
        fileUrl: "/materials/informatika.pdf",
        fileType: "PDF",
        visibility: "STUDENT_ONLY",
      },
      {
        title: "Mülki Məcəllə - Əsas Müddəalar",
        category: "QANUNVERICILIK",
        fileUrl: "/materials/mulki.pdf",
        fileType: "PDF",
        visibility: "PUBLIC",
      },
      {
        title: "Proqramlaşdırma Video Dərsi",
        category: "INFORMATIKA",
        fileUrl: "https://www.youtube.com",
        fileType: "VIDEO",
        visibility: "STUDENT_ONLY",
      },
    ],
  });

  // Sample Articles
  await prisma.article.createMany({
    data: [
      {
        title: "Müəllim Portalına Xoş Gəldiniz",
        summary: "Müəllim portalı haqqında ətraflı məlumat əldə edin.",
        content:
          "<h2>Müəllim Portalına Xoş Gəldiniz</h2><p>Bu portal müəllimlər və tələbələr üçün hazırlanmış interaktiv bir təhsil platformasıdır. Burada siz müxtəlif quiz və testlər işləyə, materiallar yükləyə və məqalələr oxuya bilərsiniz.</p><p>Platformamız sizə aşağıdakı imkanları təqdim edir:</p><ul><li>Müxtəlif kateqoriyalarda quiz və testlər</li><li>Təhsil materialları</li><li>Məqalələr və resurslar</li></ul>",
      },
      {
        title: "Qanunvericilik Sahəsində Yeniliklər 2024",
        summary: "2024-cü ildə Azərbaycan qanunvericiliyindəki əsas dəyişikliklər.",
        content:
          "<h2>Qanunvericilik Sahəsində Yeniliklər</h2><p>2024-cü ildə Azərbaycan qanunvericiliyində bir sıra mühüm dəyişikliklər edilmişdir. Bu məqalədə həmin dəyişiklikləri ətraflı şəkildə nəzərdən keçirəcəyik.</p><p>Əsas dəyişikliklər arasında vergi qanunvericiliyindəki yeniliklər, əmək münasibətlərini tənzimləyən normalar və mülki hüquq sahəsindəki islahatlar yer alır.</p>",
      },
      {
        title: "Effektiv Öyrənmə Metodları",
        summary: "Müasir təhsildə ən effektiv öyrənmə metodları haqqında.",
        content:
          "<h2>Effektiv Öyrənmə Metodları</h2><p>Müasir təhsildə öyrənmənin effektivliyini artırmaq üçün müxtəlif metodlardan istifadə edilir. Bu məqalədə ən populyar və effektiv metodları sizinlə paylaşacağıq.</p><ul><li><strong>Aktiv öyrənmə:</strong> Mövzunu başqasına izah etmək</li><li><strong>Spaced repetition:</strong> Müntəzəm təkrar</li><li><strong>Mind mapping:</strong> Fikir xəritəsi</li></ul>",
      },
    ],
  });

  // Sample results for student
  await prisma.result.create({
    data: {
      userId: student.id,
      quizId: quiz1.id,
      score: 25,
      correct: 2,
      wrong: 1,
      skipped: 0,
      answers: JSON.stringify([
        { questionId: "q1", selected: "B", isCorrect: true },
        { questionId: "q2", selected: "C", isCorrect: true },
        { questionId: "q3", selected: "A", isCorrect: false },
      ]),
    },
  });

  await prisma.result.create({
    data: {
      userId: student.id,
      quizId: quiz2.id,
      score: 15,
      correct: 1,
      wrong: 1,
      skipped: 0,
      answers: JSON.stringify([
        { questionId: "q1", selected: "B", isCorrect: true },
        { questionId: "q2", selected: "A", isCorrect: false },
      ]),
    },
  });

  console.log("✅ Seed data created successfully!");
  console.log("👑 Admin: admin@muellim.az / admin123");
  console.log("🎓 Tələbə: telebe@muellim.az / student123");
  console.log("👥 User: user@muellim.az / user123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
