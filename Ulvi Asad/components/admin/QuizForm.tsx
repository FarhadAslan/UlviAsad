"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";

const CATEGORIES = [
  { value: "QANUNVERICILIK", label: "Qanunvericilik" },
  { value: "MANTIQ", label: "Məntiq" },
  { value: "AZERBAYCAN_DILI", label: "Azərbaycan Dili" },
  { value: "INFORMATIKA", label: "İnformatika" },
  { value: "DQ_QEBUL", label: "DQ Qəbul" },
];

const emptyQuestion = () => ({
  text: "",
  options: [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ],
  correctOption: "A",
});

interface QuizFormProps {
  quiz?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function QuizForm({ quiz, onSuccess, onCancel }: QuizFormProps) {
  const { success, error } = useToast();
  const [form, setForm] = useState({
    title:      quiz?.title      || "",
    category:   quiz?.category   || "QANUNVERICILIK",
    type:       quiz?.type       || "TEST",
    duration:   quiz?.duration   || 10,
    visibility: quiz?.visibility || "PUBLIC",
    active:     quiz?.active !== undefined ? quiz.active : true,
  });
  const [questions, setQuestions] = useState<any[]>(
    quiz?.questions?.length
      ? quiz.questions.map((q: any) => ({
          text: q.text,
          options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
          correctOption: q.correctOption,
        }))
      : [emptyQuestion()]
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.some((q) => !q.text || q.options.some((o: any) => !o.text))) {
      error("Bütün sual və cavabları doldurun"); return;
    }
    if (form.type === "SINAQ" && (!form.duration || form.duration < 1)) {
      error("Sınaq üçün müddət daxil edin (minimum 1 dəqiqə)"); return;
    }
    setLoading(true);
    try {
      const res = await fetch(quiz ? `/api/quizzes/${quiz.id}` : "/api/quizzes", {
        method: quiz ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, questions }),
      });
      if (res.ok) { success(quiz ? "Quiz yeniləndi" : "Quiz yaradıldı"); onSuccess(); }
      else { const d = await res.json(); error(d.error || "Xəta baş verdi"); }
    } catch { error("Xəta baş verdi"); }
    finally { setLoading(false); }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";
  const toggleBtn = (active: boolean) =>
    `flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
      active ? "bg-[#1f6f43] text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)]"
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
        {/* Basic info */}
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
              <select value={form.category} className="select-field"
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
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

          {/* Görünürlük + Müddət — eyni sətir */}
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
                onChange={(e) => setForm((p) => ({ ...p, duration: parseInt(e.target.value) || 1 }))} />
              {form.type === "SINAQ" && (
                <p className="text-xs text-[#1a7fe0] mt-1">⏱ {form.duration} dəq = {form.duration * 60} saniyə</p>
              )}
              {form.type !== "SINAQ" && (
                <p className="text-xs text-slate-400 mt-1">Test tipində vaxt məhdudiyyəti yoxdur</p>
              )}
            </div>
          </div>

          {/* Status — ayrıca sətir */}
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
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Suallar ({questions.length})</h2>
            <button type="button" onClick={() => setQuestions((p) => [...p, emptyQuestion()])}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={15} /> Sual Əlavə Et
            </button>
          </div>

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

              <textarea value={q.text} rows={2} required placeholder="Sual mətni..."
                className="input-field mb-4 resize-none"
                onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, text: e.target.value } : x))} />

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
            </div>
          ))}
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
