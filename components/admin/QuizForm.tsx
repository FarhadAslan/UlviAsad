"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, X, ImagePlus, Loader2, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast-1";
import QuizQuestionEditor, { stripHtml } from "@/components/ui/quiz-question-editor";
import { useFormDraft } from "@/lib/useFormDraft";

const emptyQuestion = () => ({
  text: "",
  imageUrl: "",
  options: [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ],
  correctOption: "A",
  points: 1,
});

interface QuizFormProps {
  quiz?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function QuizForm({ quiz, onSuccess, onCancel }: QuizFormProps) {
  const { data: session, status } = useSession();
  const isTeacher = status !== "loading" && (session?.user as any)?.role === "TEACHER";

  const { success, error } = useToast();

  // Kateqoriyaları API-dən yüklə
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCategories(d))
      .catch(() => {});
  }, []);

  const isEditMode = !!quiz;

  const initialForm = {
    title:      quiz?.title      || "",
    category:   quiz?.category   || "",
    type:       quiz?.type       || "TEST",
    duration:   quiz?.duration   || 10,
    visibility: quiz?.visibility || "PUBLIC",
    active:     quiz?.active !== undefined ? quiz.active : true,
  };

  const [form, setForm, clearFormDraft] = useFormDraft(
    "quiz_form",
    initialForm,
    isEditMode
  );

  const initialQuestions = quiz?.questions?.length
    ? quiz.questions.map((q: any) => ({
        text: q.text,
        imageUrl: q.imageUrl || "",
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
        correctOption: q.correctOption,
        points: q.points ?? 1,
      }))
    : [emptyQuestion()];

  const [questions, setQuestions, clearQuestionsDraft] = useFormDraft<any[]>(
    "quiz_questions",
    initialQuestions,
    isEditMode
  );
  // Kateqoriyalar yüklənəndə default seç (yalnız yeni form və kateqoriya seçilməyibsə)
  useEffect(() => {
    if (!isEditMode && !form.category && categories.length > 0) {
      setForm((p) => ({ ...p, category: categories[0].value }));
    }
  }, [categories, isEditMode]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [loading,      setLoading]      = useState(false);
  const fileInputRefs  = useRef<(HTMLInputElement | null)[]>([]);

  const handleImageUpload = async (qi: number, file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      error("Yalnız şəkil faylı yükləyə bilərsiniz (JPG, PNG, GIF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      error("Şəkil ölçüsü 10MB-dan çox ola bilməz");
      return;
    }
    setUploadingIdx(qi);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res  = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { error(data.error || "Yükləmə xətası"); return; }
      setQuestions((p) => p.map((x, i) => (i === qi ? { ...x, imageUrl: data.url } : x)));
      success("Şəkil yükləndi");
    } catch {
      error("Şəkil yüklənərkən xəta baş verdi");
    } finally {
      setUploadingIdx(null);
    }
  };

  const removeImage = (qi: number) => {
    setQuestions((p) => p.map((x, i) => (i === qi ? { ...x, imageUrl: "" } : x)));
    if (fileInputRefs.current[qi]) fileInputRefs.current[qi]!.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = questions.find((q) => !stripHtml(q.text) && !q.imageUrl);
    if (invalid) { error("Hər sualda ya mətn, ya şəkil, ya da hər ikisi olmalıdır"); return; }
    if (questions.some((q) => q.options.some((o: any) => !o.text))) {
      error("Bütün cavab seçimlərini doldurun"); return;
    }
    if (form.type === "SINAQ" && (!form.duration || Number(form.duration) < 1)) {
      error("Sınaq üçün müddət daxil edin (minimum 1 dəqiqə)"); return;
    }
    setLoading(true);
    try {
      const payload = isTeacher
        ? { ...form, questions, active: undefined }  // müəllim active göndərmir
        : { ...form, questions };
      const res = await fetch(quiz ? `/api/quizzes/${quiz.id}` : "/api/quizzes", {
        method: quiz ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        success(quiz ? "Quiz yeniləndi" : "Quiz yaradıldı");
        clearFormDraft();
        clearQuestionsDraft();
        onSuccess();
      }
      else { const d = await res.json(); error(d.error || "Xəta baş verdi"); }
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
  };

  const labelCls  = "block text-sm font-medium text-slate-700 mb-1.5";
  const toggleBtn = (active: boolean) =>
    `flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
      active
        ? "bg-[#1f6f43] text-white shadow-sm"
        : "bg-white border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)]"
    }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {quiz ? "Quiz Düzəlt" : "Yeni Quiz"}
        </h1>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
          <X size={15} /> Ləğv et
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Əsas məlumatlar */}
        <div className="card-static space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Əsas Məlumatlar</h2>

          <div>
            <label className={labelCls}>Başlıq *</label>
            <input type="text" value={form.title} required className="input-field"
              placeholder="Quiz başlığı"
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Kateqoriya *</label>
              {categories.length === 0 ? (
                <div className="input-field flex items-center gap-2 text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> Yüklənir...
                </div>
              ) : (
                <select value={form.category} className="select-field"
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={labelCls}>Tip *</label>
              <div className="flex gap-2">
                {["SINAQ", "TEST"].map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm((p) => ({ ...p, type: t, duration: t === "SINAQ" ? (p.duration || 30) : p.duration }))}
                    className={toggleBtn(form.type === t)}>
                    {t === "SINAQ" ? "⏱ Sınaq" : "📝 Test"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Görünürlük</label>
              <div className="flex gap-2">
                {[{ value: "PUBLIC", label: "🌐 Açıq" }, { value: "STUDENT_ONLY", label: "🔒 Tələbə" }].map((v) => (
                  <button key={v.value} type="button"
                    onClick={() => setForm((p) => ({ ...p, visibility: v.value }))}
                    className={toggleBtn(form.visibility === v.value)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Müddət (dəqiqə){form.type === "SINAQ" && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input type="number" value={form.duration} min={1} max={180}
                required={form.type === "SINAQ"} disabled={form.type !== "SINAQ"}
                placeholder={form.type === "SINAQ" ? "Məs: 30" : "Yalnız Sınaq üçün"}
                className={`input-field ${form.type !== "SINAQ" ? "opacity-40 cursor-not-allowed" : ""}`}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({ ...p, duration: val === "" ? "" as any : parseInt(val) || 1 }));
                }} />
              {form.type === "SINAQ" && form.duration && (
                <p className="text-xs text-[#1a7fe0] mt-1">⏱ {form.duration} dəq = {Number(form.duration) * 60} saniyə</p>
              )}
              {form.type !== "SINAQ" && (
                <p className="text-xs text-slate-400 mt-1">Test tipində vaxt məhdudiyyəti yoxdur</p>
              )}
            </div>
          </div>

          {/* Status — yalnız ADMIN görür */}
          {!isTeacher && (
            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm((p) => ({ ...p, active: true }))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    form.active
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-green-400"
                  }`}>
                  <span className="w-2 h-2 rounded-full bg-current" /> Aktiv
                </button>
                <button type="button" onClick={() => setForm((p) => ({ ...p, active: false }))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    !form.active
                      ? "bg-slate-500 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}>
                  <span className="w-2 h-2 rounded-full bg-current" /> Deaktiv
                </button>
              </div>
              {isTeacher && (
                <p className="text-xs text-slate-400 mt-1">
                  ℹ️ Quiz yaradıldıqdan sonra admin tərəfindən aktivləşdiriləcək.
                </p>
              )}
            </div>
          )}

          {isTeacher && (
            <div className="rounded-xl p-3 text-xs text-amber-700 border border-amber-200 bg-amber-50">
              ℹ️ Quiz yaradıldıqdan sonra admin tərəfindən aktivləşdiriləcək. Sorğular bölməsindən aktivləşdirmə sorğusu göndərə bilərsiniz.
            </div>
          )}
        </div>

        {/* Suallar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Suallar ({questions.length})</h2>

          {questions.map((q, qi) => (
            <div key={qi} className="card-static">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#1a7fe0]">Sual {qi + 1}</span>
                {questions.length > 1 && (
                  <button type="button" onClick={() => setQuestions((p) => p.filter((_, i) => i !== qi))}
                    className="text-red-500 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="mb-3">
                <label className={labelCls}>
                  Sual mətni
                  {!q.imageUrl && <span className="text-red-500 ml-1">*</span>}
                  {q.imageUrl && <span className="text-slate-400 text-xs ml-1">(şəkil varsa mətn isteğe bağlıdır)</span>}
                </label>
                <QuizQuestionEditor
                  value={q.text}
                  onChange={(val) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, text: val } : x))}
                  placeholder="Sual mətni..."
                />
              </div>

              <div className="mb-4">
                <label className={labelCls}>
                  Sual şəkli <span className="text-slate-400 text-xs ml-1">(isteğe bağlı)</span>
                </label>
                {q.imageUrl ? (
                  <div className="relative inline-block">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50" style={{ maxWidth: 420 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.imageUrl} alt={`Sual ${qi + 1}`} className="w-full object-contain max-h-64" />
                    </div>
                    <button type="button" onClick={() => removeImage(qi)}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-md transition-colors">
                      <XCircle size={18} />
                    </button>
                    <button type="button" onClick={() => fileInputRefs.current[qi]?.click()}
                      className="mt-2 flex items-center gap-1.5 text-xs text-[#1a7fe0] hover:underline">
                      <ImagePlus size={13} /> Şəkli dəyiş
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRefs.current[qi]?.click()}
                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-[rgb(147,204,255)] rounded-xl p-6 cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30"
                    style={{ maxWidth: 420 }}>
                    {uploadingIdx === qi ? (
                      <><Loader2 size={24} className="text-[#1a7fe0] animate-spin" /><span className="text-sm text-slate-500">Yüklənir...</span></>
                    ) : (
                      <><ImagePlus size={24} className="text-slate-400" /><span className="text-sm text-slate-500">Şəkil yükləmək üçün klikləyin</span><span className="text-xs text-slate-400">JPG, PNG, GIF — maks. 10MB</span></>
                    )}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden"
                  ref={(el) => { fileInputRefs.current[qi] = el; }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(qi, f); }} />
              </div>

              <div className="space-y-2 mb-4">
                {q.options.map((opt: any, oi: number) => (
                  <div key={opt.label} className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 text-[#1a7fe0]"
                      style={{ background: "rgba(147,204,255,0.12)", border: "1px solid rgba(147,204,255,0.25)" }}>
                      {opt.label}
                    </span>
                    <input type="text" value={opt.text} required placeholder={`${opt.label} seçeneyi`}
                      className="input-field flex-1"
                      onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi
                        ? { ...x, options: x.options.map((o: any, j: number) => j === oi ? { ...o, text: e.target.value } : o) }
                        : x))} />
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-4">
                <div>
                  <label className={labelCls}>Düzgün Cavab</label>
                  <div className="flex gap-2">
                    {q.options.map((opt: any) => (
                      <button key={opt.label} type="button"
                        onClick={() => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, correctOption: opt.label } : x))}
                        className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                          q.correctOption === opt.label
                            ? "bg-green-600 text-white shadow-sm"
                            : "bg-white border border-slate-200 text-slate-500 hover:border-green-400"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ml-auto">
                  <label className={labelCls}>Bal *</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={q.points ?? 1}
                      min={1}
                      max={100}
                      required
                      className="input-field w-24 text-center"
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setQuestions((p) => p.map((x, i) => i === qi ? { ...x, points: Math.max(1, val) } : x));
                      }}
                    />
                    <span className="text-sm text-slate-500">bal</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setQuestions((p) => [...p, emptyQuestion()])}
            className="w-full py-3 rounded-xl border-2 border-dashed border-[rgba(147,204,255,0.4)] text-[#1a7fe0] hover:border-[rgb(147,204,255)] hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 text-sm font-medium">
            <Plus size={16} /> Sual Əlavə Et
          </button>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : (quiz ? "Yadda Saxla" : "Quiz Yarat")}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary px-8">Ləğv et</button>
        </div>
      </form>
    </div>
  );
}
