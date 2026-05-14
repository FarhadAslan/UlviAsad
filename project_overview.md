# Layihə İcmalı: Müəllim Portalı (muellim-portal)

Açılmış olan qovluğu analiz etdim və layihənin arxitekturası, verilənlər bazası strukturu və əsas xüsusiyyətlərini öyrəndim. Aşağıda layihənin ümumi təsviri verilmişdir:

## 🚀 İstifada Olunan Texnologiyalar (Tech Stack)
- **Framework:** Next.js 13.5.6 (App Router arxitekturası)
- **ORM və Baza:** Prisma (`@prisma/client` v5.13.0) və PostgreSQL
- **Stil və UI:** Tailwind CSS, Radix UI, Framer Motion (animasiyalar)
- **Autentifikasiya:** NextAuth.js
- **Media və 3D:** Three.js / React Three Fiber (3D elementlər), Uploadthing, Cloudinary
- **Əlavələr:** `react-quill` (mətn redaktoru), `pdf-parse`, `bcryptjs`

## 📂 Layihə Strukturu
- **`app/`**: Next.js App Router qovluğu. Burada `admin`, `api`, `auth`, `materiallar`, `meqaleler`, `neticeler`, `profil`, `quizler` kimi əsas səhifələr (routes) yerləşir.
- **`components/`**: Yenidən istifadə edilə bilən interfeys komponentləri (məs: `QuizRunner.tsx`, `HeroSection.tsx`, `AdminSidebar.tsx`, `PageTransition.tsx`).
- **`lib/`**: Köməkçi fayllar və konfiqurasiyalar (Prisma db instansı, auth opsiyaları).
- **`prisma/schema.prisma`**: Bütün verilənlər bazası strukturunu təyin edən əsas fayl.

## 🗄️ Verilənlər Bazası Strukturunun Xülasəsi (Database Schema)
Sistem çoxşaxəli istifadəçi rollarına və məzmun növlərinə sahibdir:
- **İstifadəçi Rolları (User):** `ADMIN`, `TEACHER`, `STUDENT`, `USER`. Müəllimlər və tələbələr arasında xüsusi əlaqə (`TeacherStudents`) mövcuddur. Müəllimlər öz tələbələrini idarə edə və xüsusi quizlər yarada bilər.
- **Quiz və Suallar (Quiz, Question):** Quizlər həm qapalı (CHOICE), həm də açıq (OPEN) sualları dəstəkləyir. Eyni zamanda "Pasaj" (mətn oxuyub suallara cavab vermə) tipli xüsusiyyət də daxildir. Quizlərin görünürlük səviyyələri (`PUBLIC` vs `STUDENT_ONLY`) var.
- **Nəticələr (Result):** İstifadəçilərin testlərdəki performansını (doğru, yanlış, buraxılmış suallar, bal) qeyd edir.
- **Material və Məqalə:** Tədris materialları və blog məqalələri.
- **Süni İntellekt Botları (AiBot):** Admin tərəfindən yaradılan, xüsusi promptlarla işləyən və yəqin ki, avtomatik quiz və ya məzmun yaradılmasında istifadə olunan AI bot modeli var.
- **Sorğular (Request):** Müəllimlərin adminə müraciət göndərməsi üçün (məsələn, hər hansı bir funksiyanın və ya məzmunun təsdiqlənməsi).

## ⚡ Performans Optimizasiyaları
Görünən odur ki, layihədə ciddi optimizasiyalar aparılıb (`PERFORMANCE_OPTIMIZATIONS.md` faylına əsasən):
- Next.js **Streaming və React Suspense** istifadəsi (Ana səhifədə Quiz, Material və Məqalələr paralel və ya asinxron yüklənir).
- Baza cədvəllərində müraciət sürətini artırmaq üçün **kompleks indeksləmələr** (məs: `[active, createdAt]`, `[visibility, active]`).
- 3D komponentlərin Lazy Load olunması (Hero hissəsində client-only render).
- Avtomatik şəkil optimizasiyası (Next Image).

## 🎯 Əsas Funksionallıqlar
- **Geniş Quiz Sistemi:** İstər admin, istərsə də müəllim tərəfindən idarə olunan inkişaf etmiş quiz məntiqi (`QuizRunner`).
- **Rol Əsaslı İdarəetmə Paneli:** Tam funksional `admin` paneli və müəllim/tələbə `profil` bölmələri.
- **İnteraktiv UI:** `framer-motion` və `radix-ui` vasitəsilə sürətli, animasiyalı və modern istifadəçi təcrübəsi.

Layihənin məqsədi qanunvericilik, məntiq, Azərbaycan dili kimi fənlər üzrə həm interaktiv sınaqlar/quizlər təşkil etmək, həm də tələbə-müəllim münasibətlərini (kurasiya) idarə edə bilən güclü bir təhsil portalıdır.
