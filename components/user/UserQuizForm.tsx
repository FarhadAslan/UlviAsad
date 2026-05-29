"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, X, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast-1";
import QuizQuestionEditor, { stripHtml } from "@/components/ui/quiz-question-editor";
import UserAIQuizGenerator from "@/components/user/UserAIQuizGenerator";

const emptyQuestion = () => ({
  text: "",
  imageUrl: "",
  questionType: "CHOICE" as "CHOICE" | "OPEN",
  openAnswerExample: "",
  options: [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ],
  correctOption: "A",
  points: 1,
});

interface UserQuizFormProps {
  quiz?: any;
  onSuccess: () => void;
  onCancel: () => void;
  preselectedBotId?: string;
  autoOpenAI?: boolean;
}

export default function UserQuizForm({ quiz, onSuccess, onCancel, preselectedBotId, autoOpenAI }: UserQuizFormProps) {
  const { success, error } = useToast();
  const isEditMode = !!quiz;

  const [form, setForm] = useState({
    title: quiz?.title || "",
    type: quiz?.type || "TEST",
    duration: quiz?.duration || 30,
  });

  const [questions, setQuestions] = useState<any[]>(
    quiz?.questions?.length
      ? quiz.questions.map((q: any) => ({
          text: q.text,
          imageUrl: q.imageUrl || "",
          questionType: q.questionType || "CHOICE",
          openAnswerExample: q.openAnswerExample || "",
          options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
          correctOption: q.correctOption,
          points: q.points ?? 1,
        }))
      : [emptyQuestion()]
  );

  const [loading, setLoading] = useState(false);
  const [showAI, setShowAI] = useState(!!(preselectedBotId || autoOpenAI));
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // Hansı botla yaradıldığını izləmək üçün (sourceBotId)
  const [sourceBotId, setSourceBotId] = useState<string | undefined>(
    quiz?.sourceBotId || preselectedBotId || undefined
  );

  const handleImageUpload = async (qi: number, file: File) => {
    if (!file.type.startsWith("image/")) { error("Yalnız şəkil faylı yükləyə bilərsiniz"); return; }
    if (file.size > 10 * 1024 * 1024) { error("Şəkil ölçüsü 10MB-dan çox ola bilməz"); return; }
    setUploadingIdx(qi);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.find((q) => !stripHtml(q.text) && !q.imageUrl)) {
      error("Hər sualda ya mətn, ya şəkil, ya da hər ikisi olmalıdır"); return;
    }
    if (questions.some((q) => q.questionType !== "OPEN" && q.options.some((o: any) => !o.text))) {
      error("Bütün cavab seçimlərini doldurun"); return;
    }
    if (form.type === "SINAQ" && (!form.duration || Number(form.duration) < 1)) {
      error("Sınaq üçün müddət daxil edin (minimum 1 dəqiqə)"); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        category: "UMUMI",   // istifadəçi quizləri üçün sabit dəyər
        visibility: "PRIVATE",
        active: true,
        questions,
        sourceBotId: sourceBotId || null,
      };
      const res = await fetch(quiz ? `/api/quizzes/${quiz.id}` : "/api/quizzes", {
        method: quiz ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        success(quiz ? "Quiz yeniləndi" : "Quiz yaradıldı");
        onSuccess();
      } else {
        const d = await res.json();
        error(d.error || "Xəta baş verdi");
      }
    } catch {
      error("Xəta baş verdi");
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "block text-sm font-medium text-slate-700 mb-1.5";
  const toggleBtn = (active: boolean) =>
    `flex-1 py-2.5 rounded-xl font-medium text-sm transition-all ${
      active
        ? "bg-[#1f6f43] text-white shadow-sm"
        : "bg-white border border-slate-200 text-slate-600 hover:border-[rgb(147,204,255)]"
    }`;

  return (
    <div className="px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {quiz ? "Quizi Düzəlt" : "Yeni Quiz Yarat"}
        </h2>
        <div className="flex items-center gap-2">
          {!quiz && (
            <button
              type="button"
              onClick={() => setShowAI(true)}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
            >
              <Sparkles size={15} />
              <span>AI ilə Yarat</span>
            </button>
          )}
          <button onClick={onCancel} className="btn-secondary flex items-center gap-2 text-sm">
            <X size={15} /> Ləğv et
          </button>
        </div>
      </div>

      {showAI && (
        <UserAIQuizGenerator
          preselectedBotId={preselectedBotId}
          onClose={() => setShowAI(false)}
          onGenerate={(aiQuestions, usedBotId) => {
            setQuestions(aiQuestions.length > 0 ? aiQuestions : [emptyQuestion()]);
            if (usedBotId) setSourceBotId(usedBotId);
          }}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Əsas məlumatlar */}
        <div className="card-static space-y-4">
          <h3 className="text-base font-semibold text-slate-800">Əsas Məlumatlar</h3>

          <div>
            <label className={labelCls}>
              Başlıq <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              required
              className="input-field"
              placeholder="Quiz başlığı"
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Tip</label>
            <div className="flex gap-2">
              {(["SINAQ", "TEST"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      type: t,
                      duration: t === "SINAQ" ? p.duration || 30 : p.duration,
                    }))
                  }
                  className={toggleBtn(form.type === t)}
                >
                  {t === "SINAQ" ? "⏱ Sınaq" : "📝 Test"}
                </button>
              ))}
            </div>
          </div>

          {form.type === "SINAQ" && (
            <div>
              <label className={labelCls}>
                Müddət (dəqiqə) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.duration}
                min={1}
                max={180}
                required
                className="input-field"
                placeholder="Məs: 30"
                onChange={(e) =>
                  setForm((p) => ({ ...p, duration: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
          )}

          <div className="rounded-xl p-3 text-xs text-blue-700 border border-blue-200 bg-blue-50">
            🔒 Bu quiz yalnız sizin üçün görünür — başqaları görə bilməz
          </div>
        </div>

        {/* Suallar */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-800">
            Suallar ({questions.length})
          </h3>

          {questions.map((q, qi) => (
            <div key={qi} className="card-static">
              {/* Sual header */}
              <div className="flex items-center justify-between mb-3 gap-2">
                <span className="text-sm font-semibold text-[#1a7fe0] flex-shrink-0">
                  Sual {qi + 1}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((p) =>
                        p.map((x, i) =>
                          i === qi
                            ? { ...x, questionType: x.questionType === "OPEN" ? "CHOICE" : "OPEN" }
                            : x
                        )
                      )
                    }
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      q.questionType === "OPEN"
                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200 hover:border-purple-300 hover:text-purple-600"
                    }`}
                  >
                    ✏️ {q.questionType === "OPEN" ? "Açıq" : "Açıq et"}
                  </button>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((p) => p.filter((_, i) => i !== qi))}
                      className="text-red-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sual mətni */}
              <div className="mb-3">
                <label className={labelCls}>
                  Sual mətni <span className="text-red-500">*</span>
                </label>
                <QuizQuestionEditor
                  value={q.text}
                  onChange={(val) =>
                    setQuestions((p) => p.map((x, i) => (i === qi ? { ...x, text: val } : x)))
                  }
                  placeholder="Sual mətni..."
                />
              </div>

              {/* Şəkil yükləmə */}
              <div className="mb-4">
                <label className={labelCls}>
                  Sual şəkli <span className="text-slate-400 text-xs">(isteğe bağlı)</span>
                </label>
                {q.imageUrl ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={q.imageUrl}
                      alt={`Sual ${qi + 1}`}
                      className="rounded-xl border border-slate-200 max-h-40 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((p) => p.map((x, i) => (i === qi ? { ...x, imageUrl: "" } : x)))
                      }
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRefs.current[qi]?.click()}
                    className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-[rgb(147,204,255)] rounded-xl p-5 cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30 w-full sm:max-w-xs"
                  >
                    {uploadingIdx === qi ? (
                      <>
                        <Loader2 size={20} className="text-[#1a7fe0] animate-spin" />
                        <span className="text-xs text-slate-500">Yüklənir...</span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 text-center">
                        Şəkil yükləmək üçün klikləyin
                      </span>
                    )}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={(el) => { fileInputRefs.current[qi] = el; }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(qi, f);
                  }}
                />
              </div>

              {/* Variantlar — CHOICE */}
              {q.questionType !== "OPEN" && (
                <div className="space-y-2 mb-4">
                  {q.options.map((opt: any, oi: number) => (
                    <div key={opt.label} className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 text-[#1a7fe0]"
                        style={{ background: "rgba(147,204,255,0.12)", border: "1px solid rgba(147,204,255,0.25)" }}
                      >
                        {opt.label}
                      </span>
                      <input
                        type="text"
                        value={opt.text}
                        required
                        placeholder={`${opt.label} seçeneyi`}
                        className="input-field flex-1 text-sm"
                        onChange={(e) =>
                          setQuestions((p) =>
                            p.map((x, i) =>
                              i === qi
                                ? { ...x, options: x.options.map((o: any, j: number) => j === oi ? { ...o, text: e.target.value } : o) }
                                : x
                            )
                          )
                        }
                      />
                      {oi === q.options.length - 1 && q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuestions((p) =>
                              p.map((x, i) => {
                                if (i !== qi) return x;
                                const newOpts = x.options.slice(0, -1);
                                return { ...x, options: newOpts, correctOption: x.correctOption === opt.label ? "A" : x.correctOption };
                              })
                            )
                          }
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        const labels = ["A", "B", "C", "D", "E", "F"];
                        setQuestions((p) =>
                          p.map((x, i) =>
                            i === qi
                              ? { ...x, options: [...x.options, { label: labels[x.options.length], text: "" }] }
                              : x
                          )
                        );
                      }}
                      className="flex items-center gap-1.5 text-xs text-[#1a7fe0] font-medium mt-1 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
                    >
                      <Plus size={12} /> Variant əlavə et
                    </button>
                  )}
                </div>
              )}

              {/* Açıq sual */}
              {q.questionType === "OPEN" && (
                <div className="space-y-3 mb-4 p-3 sm:p-4 rounded-xl bg-purple-50 border border-purple-100">
                  <p className="text-xs text-purple-700 font-medium">
                    ✏️ Açıq sual — istifadəçi öz cavabını yazacaq
                  </p>
                  <div>
                    <label className={labelCls}>
                      Düzgün Cavab <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={q.correctOption}
                      required
                      placeholder="Məs: Bakı"
                      className="input-field"
                      onChange={(e) =>
                        setQuestions((p) =>
                          p.map((x, i) => (i === qi ? { ...x, correctOption: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {/* Düzgün cavab + bal */}
              {q.questionType !== "OPEN" && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div>
                    <label className={labelCls}>Düzgün Cavab</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {q.options.map((opt: any) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() =>
                            setQuestions((p) =>
                              p.map((x, i) => (i === qi ? { ...x, correctOption: opt.label } : x))
                            )
                          }
                          className={`w-9 h-9 rounded-xl font-bold text-sm transition-all ${
                            q.correctOption === opt.label
                              ? "bg-green-600 text-white shadow-sm"
                              : "bg-white border border-slate-200 text-slate-500 hover:border-green-400"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sm:ml-auto">
                    <label className={labelCls}>Bal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={q.points ?? 1}
                        min={1}
                        max={100}
                        required
                        className="input-field w-20 text-center"
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setQuestions((p) =>
                            p.map((x, i) => (i === qi ? { ...x, points: Math.max(1, val) } : x))
                          );
                        }}
                      />
                      <span className="text-sm text-slate-500">bal</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setQuestions((p) => [...p, emptyQuestion()])}
            className="w-full py-3 rounded-xl border-2 border-dashed border-[rgba(147,204,255,0.4)] text-[#1a7fe0] hover:border-[rgb(147,204,255)] hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            <Plus size={16} /> Sual Əlavə Et
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : quiz ? "Yadda Saxla" : "Quiz Yarat"}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary px-6 sm:px-8">
            Ləğv et
          </button>
        </div>
      </form>
    </div>
  );
}
