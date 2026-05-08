# Requirements Document

## Introduction

Bu feature mövcud Next.js quiz platformasına **mətn əsaslı quiz tipi** əlavə edir. Mətn əsaslı quizlərdə istifadəçiyə əvvəlcə bir passage (mətn parçası) təqdim edilir, suallar isə həmin mətnə əsaslanır. İstifadəçi "Mətn" və "Suallar" tab-ları arasında keçid edərək quizi işləyir. Admin/müəllim panelindən bu tip quiz yaradılarkən mətn, başlıq şəkli və sitat blokları əlavə edilə bilər.

Mövcud quiz tipləri (`SINAQ`, `TEST`) dəyişdirilmir; yeni `METN` tipi əlavə olunur. Mövcud `QuizRunner` komponenti genişləndirilir, `QuizForm` komponenti yeni tip üçün mətn redaktoru ilə zənginləşdirilir, Prisma sxeması yeni sahələrlə yenilənir.

---

## Glossary

- **Quiz_Runner**: Quizi istifadəçiyə göstərən və idarə edən `QuizRunner` komponenti.
- **Quiz_Form**: Admin/müəllim panelindəki quiz yaratma/redaktə formu (`QuizForm` komponenti).
- **Passage**: Quizin əsaslandığı mətn parçası (başlıq şəkli, paraqraflar, sitat blokları).
- **Passage_Tab**: Quiz işləmə interfeysinə əlavə edilən "Mətn" tab-ı; Passage-i göstərir.
- **Questions_Tab**: Quiz işləmə interfeysinə əlavə edilən "Suallar" tab-ı; adi sualları göstərir.
- **Quote_Block**: Passage daxilindəki yaşıl fon üzərindəki sitat/vurğu bloku.
- **METN**: Yeni quiz tipi dəyəri; mətn əsaslı quizləri identifikasiya edir.
- **Passage_Image**: Passage-in yuxarısında göstərilən başlıq şəkli.
- **Quiz_API**: `/api/quizzes` endpoint-i.
- **Prisma_Schema**: `prisma/schema.prisma` faylındakı verilənlər bazası sxemi.

---

## Requirements

### Requirement 1: Verilənlər Bazası Sxeminin Genişləndirilməsi

**User Story:** Bir admin olaraq, mətn əsaslı quiz yarada bilmək üçün Quiz modelinin passage məlumatlarını saxlamasını istəyirəm.

#### Acceptance Criteria

1. THE Prisma_Schema SHALL `Quiz` modelinə `passageTitle` (String, nullable), `passageContent` (String, nullable), `passageImageUrl` (String, nullable) sahələrini əlavə etməlidir.
2. THE Prisma_Schema SHALL `Quiz` modelinin `type` sahəsinin `METN` dəyərini qəbul etməsinə imkan verməlidir.
3. WHEN `Quiz` modeli `METN` tipinə malik olduqda, THE Prisma_Schema SHALL `passageContent` sahəsinin null olmayan dəyər saxlamasına imkan verməlidir.
4. THE Prisma_Schema SHALL mövcud `SINAQ` və `TEST` tipli quizlərə heç bir dəyişiklik tətbiq etməməlidir.

---

### Requirement 2: Quiz API-nin Genişləndirilməsi

**User Story:** Bir admin olaraq, mətn əsaslı quiz yaradarkən passage məlumatlarının saxlanmasını istəyirəm.

#### Acceptance Criteria

1. WHEN `POST /api/quizzes` sorğusu `type: "METN"` ilə göndərildikdə, THE Quiz_API SHALL `passageTitle`, `passageContent`, `passageImageUrl` sahələrini verilənlər bazasına yazmalıdır.
2. WHEN `PUT /api/quizzes/[id]` sorğusu göndərildikdə, THE Quiz_API SHALL `passageTitle`, `passageContent`, `passageImageUrl` sahələrini yeniləməlidir.
3. WHEN `GET /api/quizzes/[id]` sorğusu göndərildikdə, THE Quiz_API SHALL `passageTitle`, `passageContent`, `passageImageUrl` sahələrini cavabda qaytarmalıdır.
4. IF `type: "METN"` olan quiz üçün `passageContent` boş göndərildikdə, THEN THE Quiz_API SHALL `400` status kodu və `"Mətn əsaslı quiz üçün passage mətni tələb olunur"` xəta mesajı qaytarmalıdır.
5. WHEN `type: "SINAQ"` və ya `type: "TEST"` olan quiz üçün sorğu göndərildikdə, THE Quiz_API SHALL `passageTitle`, `passageContent`, `passageImageUrl` sahələrini `null` olaraq saxlamalıdır.

---

### Requirement 3: Admin Panelindəki Quiz Formu — Mətn Əsaslı Tip

**User Story:** Bir admin/müəllim olaraq, quiz yaradarkən "Mətn əsaslı" tipini seçib passage məlumatlarını daxil etmək istəyirəm.

#### Acceptance Criteria

1. THE Quiz_Form SHALL mövcud `SINAQ` və `TEST` tip seçimlərinə əlavə olaraq `METN` ("📖 Mətn") seçimini göstərməlidir.
2. WHEN `METN` tipi seçildikdə, THE Quiz_Form SHALL passage məlumatları üçün ayrıca bölmə açmalıdır: passage başlığı (text input), passage şəkli (şəkil yükləmə), passage mətni (rich text redaktoru).
3. WHEN `METN` tipi seçildikdə, THE Quiz_Form SHALL müddət sahəsini deaktiv etməlidir, çünki `METN` tipi vaxtsızdır.
4. WHEN `METN` tipi seçilmədikdə, THE Quiz_Form SHALL passage bölməsini gizlətməlidir.
5. WHEN `METN` tipi seçilib passage mətni boş saxlanıldıqda, THE Quiz_Form SHALL formu göndərməməli və `"Mətn əsaslı quiz üçün passage mətni tələb olunur"` xəbərdarlığı göstərməlidir.
6. THE Quiz_Form SHALL `METN` tipli quiz üçün sualların əlavə edilməsinə mövcud sual redaktoru vasitəsilə imkan verməlidir.
7. WHEN `METN` tipi seçildikdə, THE Quiz_Form SHALL passage şəkli üçün mövcud şəkil yükləmə mexanizmindən istifadə etməlidir.

---

### Requirement 4: Quiz İşləmə İnterfeysi — Tab Strukturu

**User Story:** Bir istifadəçi olaraq, mətn əsaslı quizi işləyərkən "Mətn" və "Suallar" tab-ları arasında keçid etmək istəyirəm.

#### Acceptance Criteria

1. WHEN `METN` tipli quiz `running` fazasında olduqda, THE Quiz_Runner SHALL "Mətn" və "Suallar" adlı iki tab göstərməlidir.
2. WHEN istifadəçi "Mətn" tab-ını seçdikdə, THE Quiz_Runner SHALL Passage_Tab-ı göstərməli, Questions_Tab-ı gizlətməlidir.
3. WHEN istifadəçi "Suallar" tab-ını seçdikdə, THE Quiz_Runner SHALL Questions_Tab-ı göstərməli, Passage_Tab-ı gizlətməlidir.
4. WHILE `METN` tipli quiz `running` fazasında olduqda, THE Quiz_Runner SHALL aktiv tab-ı vizual olaraq vurğulamalıdır (aktiv tab fərqli rəng/stil ilə).
5. WHEN `SINAQ` və ya `TEST` tipli quiz `running` fazasında olduqda, THE Quiz_Runner SHALL tab strukturunu göstərməməlidir.
6. THE Quiz_Runner SHALL `METN` tipli quizin `start` fazasında mövcud başlanğıc ekranını göstərməlidir (tab-sız).

---

### Requirement 5: Mətn Tab-ının Görünüşü

**User Story:** Bir istifadəçi olaraq, "Mətn" tab-ında passage məzmununu — başlıq şəklini, mətni və sitat bloklarını — oxumaq istəyirəm.

#### Acceptance Criteria

1. WHEN Passage_Tab aktiv olduqda, THE Quiz_Runner SHALL `passageImageUrl` mövcuddursa başlıq şəklini "Dərs Materialı" badge-i ilə birlikdə göstərməlidir.
2. WHEN Passage_Tab aktiv olduqda, THE Quiz_Runner SHALL `passageContent` mətnini HTML render edərək göstərməlidir.
3. WHEN Passage_Tab aktiv olduqda, THE Quiz_Runner SHALL `passageContent` daxilindəki `<blockquote>` elementlərini yaşıl fon üzərindəki Quote_Block kimi stilləndirməlidir.
4. WHEN `passageImageUrl` null olduqda, THE Quiz_Runner SHALL başlıq şəkli bölməsini göstərməməlidir.
5. WHEN `passageTitle` mövcuddursa, THE Quiz_Runner SHALL passage başlığını Passage_Tab-da göstərməlidir.

---

### Requirement 6: Suallar Tab-ının Görünüşü

**User Story:** Bir istifadəçi olaraq, "Suallar" tab-ında adi quiz suallarını cavablandırmaq istəyirəm.

#### Acceptance Criteria

1. WHEN Questions_Tab aktiv olduqda, THE Quiz_Runner SHALL mövcud sual göstərmə və cavab seçmə mexanizmini saxlamalıdır.
2. WHEN Questions_Tab aktiv olduqda, THE Quiz_Runner SHALL sual naviqasiyasını (əvvəlki/növbəti düymələri) göstərməlidir.
3. WHEN Questions_Tab aktiv olduqda, THE Quiz_Runner SHALL sual grid naviqasiyasını (≡ düyməsi ilə açılan sual siyahısı) göstərməlidir.
4. WHEN istifadəçi son sualda "Bitir" düyməsini kliklədikdə, THE Quiz_Runner SHALL quizi bitirməli və nəticə fazasına keçməlidir.
5. THE Quiz_Runner SHALL `METN` tipli quizlər üçün timer göstərməməlidir, çünki `METN` tipi vaxtsızdır.

---

### Requirement 7: Naviqasiya Düymələri

**User Story:** Bir istifadəçi olaraq, quiz işləyərkən "Mətn" tab-ına keçmək üçün ayrıca düymə istəyirəm.

#### Acceptance Criteria

1. WHILE `METN` tipli quiz `running` fazasında olduqda, THE Quiz_Runner SHALL Questions_Tab-da "Mətnə bax" düyməsini göstərməlidir.
2. WHEN istifadəçi "Mətnə bax" düyməsini kliklədikdə, THE Quiz_Runner SHALL Passage_Tab-a keçməlidir.
3. WHILE `METN` tipli quiz `running` fazasında olduqda, THE Quiz_Runner SHALL Passage_Tab-da "Suallara keç" düyməsini göstərməlidir.
4. WHEN istifadəçi "Suallara keç" düyməsini kliklədikdə, THE Quiz_Runner SHALL Questions_Tab-a keçməlidir.

---

### Requirement 8: Quiz Siyahısı və Filtrləmə

**User Story:** Bir istifadəçi olaraq, quiz siyahısında mətn əsaslı quizləri görüb filtrləyə bilmək istəyirəm.

#### Acceptance Criteria

1. THE Quiz_Runner SHALL `METN` tipli quizlər üçün başlanğıc ekranında `"📖 Mətn Əsaslı"` badge-i göstərməlidir.
2. WHEN quiz siyahısı göstərildikdə, THE Quiz_Runner SHALL `METN` tipli quizlər üçün `QuizCard` komponentinin tip badge-ini `"Mətn Əsaslı"` kimi göstərməlidir.
3. THE Quiz_API SHALL `type: "METN"` filtri ilə sorğu qəbul etdikdə yalnız mətn əsaslı quizləri qaytarmalıdır.

---

### Requirement 9: Nəticə Fazası

**User Story:** Bir istifadəçi olaraq, mətn əsaslı quizi bitirdikdən sonra nəticəmi görmək istəyirəm.

#### Acceptance Criteria

1. WHEN `METN` tipli quiz bitdikdə, THE Quiz_Runner SHALL mövcud nəticə ekranını göstərməlidir (düzgün/səhv/cavablanmamış sayları, faiz, liderboard).
2. WHEN `METN` tipli quiz nəticəsi göstərildikdə, THE Quiz_Runner SHALL `SINAQ` tipindəki kimi time bonus hesablamamalıdır.
3. WHEN `METN` tipli quiz nəticəsi göstərildikdə, THE Quiz_Runner SHALL detallı cavab baxışını mövcud mexanizmlə göstərməlidir.

