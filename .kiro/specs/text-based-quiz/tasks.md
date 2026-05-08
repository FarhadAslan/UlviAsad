# Implementation Plan: Text-Based Quiz (METN Tipi)

## Overview

Bu plan mövcud Next.js quiz platformasına `METN` quiz tipini əlavə etmək üçün ardıcıl kodlaşdırma tapşırıqlarını əhatə edir. Tapşırıqlar aşağıdakı ardıcıllıqla icra edilir: Prisma sxemi → API genişləndirilməsi → utility funksiyası → QuizForm → QuizRunner → CSS stilləri → QuizCard.

## Tasks

- [x] 1. Prisma sxeminin yenilənməsi və migration
  - [x] 1.1 `prisma/schema.prisma` faylında `Quiz` modelinə üç yeni nullable sahə əlavə et
    - `passageTitle String?` — passage başlığı (isteğe bağlı)
    - `passageContent String?` — passage HTML mətni (METN tipi üçün şərti məcburi)
    - `passageImageUrl String?` — passage başlıq şəklinin URL-i (isteğe bağlı)
    - Mövcud `SINAQ`/`TEST` quizlərinin sahələri dəyişdirilmir
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Yeni Prisma migration yarat və tətbiq et
    - `npx prisma migrate dev --name add_passage_fields` əmrini icra et
    - Migration faylının `ALTER TABLE "Quiz" ADD COLUMN` ifadələrini ehtiva etdiyini yoxla
    - `npx prisma generate` ilə Prisma Client-i yenilə
    - _Requirements: 1.1_

  - [ ]* 1.3 Prisma sxemi dəyişikliklərini yoxla
    - `Quiz` modelinin yeni sahələrini ehtiva etdiyini yoxla
    - Mövcud sahələrin dəyişmədiyini yoxla
    - _Requirements: 1.1, 1.4_

- [x] 2. Quiz API-nin genişləndirilməsi
  - [x] 2.1 `app/api/quizzes/route.ts` — POST handler-ə passage sahələri əlavə et
    - `body`-dən `passageTitle`, `passageContent`, `passageImageUrl` sahələrini çıxart
    - `type === "METN"` olduqda `passageContent` boşluq yoxlaması əlavə et: boşsa `400` qaytar
    - `prisma.quiz.create` data bloğuna yeni sahələri əlavə et: `METN` tipi üçün dəyərləri, digər tiplər üçün `null`
    - _Requirements: 2.1, 2.4, 2.5_

  - [ ]* 2.2 Property testi — boş passage mətni rədd edilir (Property 2)
    - **Property 2: Boş passage mətni rədd edilir**
    - `fast-check` ilə boş sətir, null, yalnız boşluqlardan ibarət sətir üçün `400` status kodu qaytarıldığını yoxla
    - **Validates: Requirements 2.4, 3.5**

  - [ ]* 2.3 Property testi — SINAQ/TEST quizlərinin passage sahələri null olur (Property 3)
    - **Property 3: SINAQ/TEST quizlərinin passage sahələri null olur**
    - `fast-check` ilə `SINAQ` və `TEST` tipli quizlər üçün `passageTitle`, `passageContent`, `passageImageUrl` sahələrinin `null` saxlandığını yoxla
    - **Validates: Requirements 2.5, 1.4**

  - [x] 2.4 `app/api/quizzes/[id]/route.ts` — GET handler-ə passage sahələri əlavə et
    - `select` bloğuna `passageTitle`, `passageContent`, `passageImageUrl` sahələrini əlavə et
    - Cavabda bu sahələrin qaytarıldığını yoxla
    - _Requirements: 2.3_

  - [x] 2.5 `app/api/quizzes/[id]/route.ts` — PUT handler-ə passage sahələri əlavə et
    - `body`-dən `passageTitle`, `passageContent`, `passageImageUrl` sahələrini çıxart
    - POST handler-dəki eyni validasiya məntiqi: `METN` tipi üçün boşluq yoxlaması
    - `prisma.quiz.update` data bloğuna yeni sahələri əlavə et: `METN` tipi üçün dəyərləri, digər tiplər üçün `null`
    - _Requirements: 2.2, 2.4, 2.5_

  - [ ]* 2.6 Property testi — passage məlumatlarının round-trip saxlanması (Property 1)
    - **Property 1: Passage məlumatlarının round-trip saxlanması**
    - `fast-check` ilə etibarlı `passageTitle`, `passageContent`, `passageImageUrl` dəyərləri ilə quiz yaradıb GET ilə oxuduqda eyni dəyərlərin qaytarıldığını yoxla
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 2.7 Property testi — tip filtri yalnız uyğun quizləri qaytarır (Property 4)
    - **Property 4: Tip filtri yalnız uyğun quizləri qaytarır**
    - `fast-check` ilə `type=METN` filtri ilə sorğu göndərildikdə qaytarılan bütün quizlərin `METN` tipinə malik olduğunu yoxla
    - **Validates: Requirements 8.3**

- [ ] 3. Checkpoint — API testlərini yoxla
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. `lib/utils.ts` — `getTypeLabel` funksiyasının yenilənməsi
  - [x] 4.1 `getTypeLabel` funksiyasını `METN` tipini dəstəkləyəcək şəkildə yenilə
    - `"METN"` tipi üçün `"Mətn Əsaslı"` qaytarılmasını əlavə et
    - `"SINAQ"` → `"Sınaq"` və `"TEST"` → `"Test"` geriyə uyğunluğunu qoru
    - _Requirements: 8.2_

  - [ ]* 4.2 Unit testlər — `getTypeLabel` funksiyası
    - `getTypeLabel("METN")` → `"Mətn Əsaslı"` qaytarır
    - `getTypeLabel("SINAQ")` → `"Sınaq"` qaytarır (geriyə uyğunluq)
    - `getTypeLabel("TEST")` → `"Test"` qaytarır (geriyə uyğunluq)
    - _Requirements: 8.2_

  - [ ]* 4.3 Property testi — `getTypeLabel` bütün etibarlı tiplər üçün düzgün etiket qaytarır (Property 6)
    - **Property 6: getTypeLabel bütün etibarlı tiplər üçün düzgün etiket qaytarır**
    - `fast-check` ilə `"SINAQ"`, `"TEST"`, `"METN"` tipləri üçün boş olmayan, tip dəyərindən fərqli etiket qaytarıldığını yoxla
    - **Validates: Requirements 8.2**

- [x] 5. `components/admin/QuizForm.tsx` — METN tipi və passage bölməsi
  - [x] 5.1 Form state-ə passage sahələrini əlavə et
    - `initialForm` obyektinə `passageTitle`, `passageContent`, `passageImageUrl` sahələrini əlavə et
    - `quiz?.passageTitle || ""`, `quiz?.passageContent || ""`, `quiz?.passageImageUrl || ""` ilə inisializasiya et
    - `useFormDraft` hook-u ilə draft saxlanmasını təmin et
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 Tip seçimi düymələrinə `METN` əlavə et
    - Mövcud `["SINAQ", "TEST"]` massivini `["SINAQ", "TEST", "METN"]` ilə əvəz et
    - `METN` üçün `"📖 Mətn"` etiketi göstər
    - `METN` seçildikdə `duration` sahəsini dəyişmə (mövcud `form.type !== "SINAQ"` şərti `METN`-i avtomatik deaktiv edir)
    - _Requirements: 3.1, 3.3_

  - [x] 5.3 Passage bölməsini şərti render et (`form.type === "METN"` olduqda)
    - `card-static` konteyner daxilində "Passage Məlumatları" başlığı ilə bölmə yarat
    - Passage başlığı üçün `input-field` text input əlavə et (`passageTitle` state-ə bağla)
    - Passage şəkli üçün mövcud şəkil yükləmə mexanizmindən istifadə et (yeni `passageImageUrl` state-ə bağla)
    - Passage mətni üçün mövcud `RichEditor` komponentini import edib əlavə et (`passageContent` state-ə bağla)
    - `form.type !== "METN"` olduqda bölməni gizlət
    - _Requirements: 3.2, 3.4, 3.7_

  - [x] 5.4 `handleSubmit` funksiyasına passage validasiyası əlavə et
    - `form.type === "METN"` olduqda `passageContent?.trim()` boşluq yoxlaması əlavə et
    - Boşsa `error("Mətn əsaslı quiz üçün passage mətni tələb olunur")` toast göstər və `return` et
    - `payload` obyektinə `passageTitle`, `passageContent`, `passageImageUrl` sahələrini əlavə et
    - _Requirements: 3.5, 3.6_

  - [ ]* 5.5 Unit testlər — QuizForm komponenti
    - `METN` seçiminin göstərildiyini yoxla
    - `METN` seçildikdə passage bölməsinin göründüyünü yoxla
    - `METN` seçilmədikdə passage bölməsinin gizləndiyini yoxla
    - `METN` seçildikdə müddət sahəsinin deaktiv olduğunu yoxla
    - Boş passage mətni ilə form göndərilmədiyini yoxla
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. `components/QuizRunner.tsx` — tab strukturu və PassageView
  - [x] 6.1 `isMetn` dəyişəni və `activeTab` state-i əlavə et
    - `const isMetn = quiz.type === "METN"` dəyişənini əlavə et
    - `const [activeTab, setActiveTab] = useState<"passage" | "questions">("passage")` state-i əlavə et
    - _Requirements: 4.1, 4.6_

  - [x] 6.2 `PassageView` inline funksiya komponentini `QuizRunner.tsx` daxilində yarat
    - Props: `quiz: any`, `onGoToQuestions: () => void`
    - `quiz.passageImageUrl` mövcuddursa başlıq şəklini "📚 Dərs Materialı" badge-i ilə göstər; null olduqda gizlət
    - `quiz.passageTitle` mövcuddursa başlığı `h2` kimi göstər
    - `quiz.passageContent`-i `dangerouslySetInnerHTML` ilə `passage-content` CSS class-lı `div`-də render et
    - "Suallara keç →" düyməsini `btn-primary` class-ı ilə əlavə et; klikdə `onGoToQuestions()` çağır
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.3, 7.4_

  - [x] 6.3 Running fazasında `METN` tipi üçün tab strukturunu render et
    - `isMetn` olduqda "📖 Mətn" və "❓ Suallar" tab düymələrini göstər
    - Aktiv tab-ı `bg-[#1f6f43] text-white` stili ilə vurğula; qeyri-aktiv tab-ı `bg-white border border-slate-200` stili ilə göstər
    - `isMetn && activeTab === "passage"` olduqda `PassageView` komponentini render et
    - `!isMetn || activeTab === "questions"` olduqda mövcud sual görünüşünü render et
    - `SINAQ`/`TEST` tipli quizlər üçün tab strukturunu göstərmə
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.4 Questions Tab-da "Mətnə bax" düyməsini əlavə et
    - `isMetn` olduqda naviqasiya düymələri bölməsinin yuxarısında "📖 Mətnə bax" düyməsini göstər
    - Klikdə `setActiveTab("passage")` çağır
    - _Requirements: 7.1, 7.2_

  - [x] 6.5 Start fazasında `METN` tipi üçün badge əlavə et
    - Start fazasındakı badge bölməsini `METN` tipini dəstəkləyəcək şəkildə yenilə
    - `quiz.type === "METN"` olduqda `"📖 Mətn Əsaslı"` badge-i göstər (mövcud `badge-type-test` class-ı ilə)
    - _Requirements: 8.1_

  - [x] 6.6 `METN` tipli quizlər üçün time bonus sıfır olduğunu təmin et
    - Mövcud `isSinaq && !autoSubmit` şərtinin `METN`-i avtomatik istisna etdiyini yoxla
    - `isMetn` olduqda `timeBonus = 0` olduğunu təmin et
    - _Requirements: 9.2_

  - [ ]* 6.7 Unit testlər — QuizRunner komponenti
    - `METN` tipli quiz running fazasında iki tab göstərildiyini yoxla
    - `SINAQ`/`TEST` tipli quiz running fazasında tab göstərilmədiyini yoxla
    - "Mətn" tab-ına klikləndikdə PassageView göründüyünü yoxla
    - "Suallar" tab-ına klikləndikdə sual görünüşünün göründüyünü yoxla
    - `METN` tipli quiz üçün timer göstərilmədiyini yoxla
    - `passageImageUrl` null olduqda şəkil bölməsinin göstərilmədiyini yoxla
    - `passageTitle` mövcud olduqda başlığın göstərildiyini yoxla
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.4, 5.5, 6.5_

  - [ ]* 6.8 Property testi — METN tipli quizlər üçün time bonus sıfırdır (Property 5)
    - **Property 5: METN tipli quizlər üçün time bonus sıfırdır**
    - `fast-check` ilə istənilən `startTime` və `elapsed` dəyərləri üçün `METN` tipli quiz nəticəsinin `timeBonus = 0` olduğunu yoxla
    - **Validates: Requirements 9.2**

- [ ] 7. Checkpoint — UI komponentlərini yoxla
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. `app/globals.css` — blockquote stilləndirməsi
  - [x] 8.1 `.passage-content` CSS class-ı üçün `blockquote` stilini əlavə et
    - `.passage-content blockquote` seçicisi üçün aşağıdakı stilləri əlavə et:
      - `background-color: #1f6f43` (yaşıl fon)
      - `color: white`
      - `border-left: none`
      - `border-radius: 12px`
      - `padding: 16px 20px`
      - `margin: 16px 0`
      - `font-style: normal`
    - _Requirements: 5.3_

  - [x] 8.2 `.passage-content` üçün ümumi mətn stilləri əlavə et
    - `p`, `h2`, `h3`, `ul`, `ol`, `li` elementləri üçün uyğun boşluq və rəng stilləri əlavə et
    - Mövcud `.rich-content` class-ı ilə uyğunluğu qoru
    - _Requirements: 5.2_

- [x] 9. `components/QuizCard.tsx` — METN badge-i
  - [x] 9.1 `QuizCard` komponentindəki tip badge-ini `METN` tipini dəstəkləyəcək şəkildə yenilə
    - Mövcud `quiz.type === "SINAQ" ? "badge-type-sinaq" : "badge-type-test"` şərtini genişləndir
    - `METN` tipi üçün `badge-type-metn` CSS class-ı tətbiq et
    - `globals.css`-ə `.badge-type-metn` class-ı əlavə et: yaşıl fon (`rgba(31,111,67,0.1)`), yaşıl mətn (`#1f6f43`), yaşıl kənar (`rgba(31,111,67,0.3)`)
    - `getTypeLabel(quiz.type)` çağırışı artıq `"Mətn Əsaslı"` qaytaracaq (Task 4.1-dən sonra)
    - _Requirements: 8.2_

- [ ] 10. Final checkpoint — Bütün testlər keçir
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- `*` ilə işarələnmiş tapşırıqlar isteğe bağlıdır və sürətli MVP üçün keçilə bilər
- Hər tapşırıq spesifik tələblərə istinad edir (izlənilə bilirlik üçün)
- Checkpointlər artımlı doğrulama təmin edir
- Property testlər universal düzgünlük xüsusiyyətlərini yoxlayır
- Unit testlər spesifik nümunələri və kənar halları yoxlayır
- `fast-check` kitabxanası property-based testlər üçün istifadə edilir
