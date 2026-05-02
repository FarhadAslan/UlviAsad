"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, List,
  Superscript, Subscript, RemoveFormatting,
} from "lucide-react";

interface QuizQuestionEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
}

// HTML-dən düz mətn çıxarır — boşluq yoxlaması üçün
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export default function QuizQuestionEditor({
  value,
  onChange,
  placeholder = "Sual mətni... (şəkil əlavə etsəniz boş qoya bilərsiniz)",
  required = false,
}: QuizQuestionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternal = useRef(false);

  // Xarici value dəyişdikdə (edit mode) editor-u yenilə
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternal.current) { isInternal.current = false; return; }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternal.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const tools: Array<{
    icon: React.ElementType;
    title: string;
    action: () => void;
    cmd?: string;
  } | null> = [
    { icon: Bold,             title: "Qalın (Ctrl+B)",        action: () => exec("bold"),            cmd: "bold" },
    { icon: Italic,           title: "Kursiv (Ctrl+I)",        action: () => exec("italic"),          cmd: "italic" },
    { icon: Underline,        title: "Altı xəttli (Ctrl+U)",   action: () => exec("underline"),       cmd: "underline" },
    null,
    { icon: Superscript,      title: "Üst indeks (x²)",        action: () => exec("superscript") },
    { icon: Subscript,        title: "Alt indeks (H₂O)",       action: () => exec("subscript") },
    null,
    { icon: List,             title: "Siyahı",                 action: () => exec("insertUnorderedList") },
    null,
    { icon: RemoveFormatting, title: "Formatı sil",            action: () => exec("removeFormat") },
  ];

  return (
    <div
      className="rounded-xl border border-slate-200 overflow-hidden bg-white focus-within:border-[rgb(147,204,255)] transition-colors"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
        {tools.map((tool, i) =>
          tool === null ? (
            <div key={i} className="w-px h-4 bg-slate-200 mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              title={tool.title}
              onMouseDown={(e) => { e.preventDefault(); tool.action(); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all"
            >
              <tool.icon size={14} />
            </button>
          )
        )}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        className="quiz-editor-content outline-none px-3 py-2.5 text-slate-800 text-sm leading-relaxed"
        style={{ minHeight: 72 }}
      />

      <style jsx>{`
        .quiz-editor-content:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          display: block;
        }
        .quiz-editor-content b,
        .quiz-editor-content strong { font-weight: 700; }
        .quiz-editor-content i,
        .quiz-editor-content em { font-style: italic; }
        .quiz-editor-content u { text-decoration: underline; }
        .quiz-editor-content sup { font-size: 0.75em; vertical-align: super; }
        .quiz-editor-content sub { font-size: 0.75em; vertical-align: sub; }
        .quiz-editor-content ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .quiz-editor-content ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
      `}</style>
    </div>
  );
}
