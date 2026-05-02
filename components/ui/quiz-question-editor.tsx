"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// SSR-də Quill işləmir — dynamic import məcburidir
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => (
    <div className="h-24 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />
  ),
});

// react-quill CSS-i
import "react-quill/dist/quill.snow.css";

interface QuizQuestionEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

// HTML-dən düz mətn çıxarır — boşluq yoxlaması üçün
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// Quill toolbar konfiqurasiyası
const TOOLBAR = [
  // Mətn formatı
  [{ header: [1, 2, 3, false] }],
  // Əsas formatlar
  ["bold", "italic", "underline", "strike"],
  // Rəng
  [{ color: [] }, { background: [] }],
  // Üst/alt indeks
  [{ script: "super" }, { script: "sub" }],
  // Siyahılar
  [{ list: "ordered" }, { list: "bullet" }],
  // Girinti
  [{ indent: "-1" }, { indent: "+1" }],
  // Hizalama
  [{ align: [] }],
  // Xətt, blok sitat
  ["blockquote", "code-block"],
  // Təmizlə
  ["clean"],
];

const FORMATS = [
  "header",
  "bold", "italic", "underline", "strike",
  "color", "background",
  "script",
  "list", "bullet",
  "indent",
  "align",
  "blockquote", "code-block",
];

export default function QuizQuestionEditor({
  value,
  onChange,
  placeholder = "Sual mətni...",
}: QuizQuestionEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: TOOLBAR,
    }),
    []
  );

  return (
    <div className="quiz-quill-wrapper">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={FORMATS}
        placeholder={placeholder}
      />

      <style jsx global>{`
        /* ── Wrapper ─────────────────────────────────────────── */
        .quiz-quill-wrapper .ql-container.ql-snow {
          border: none;
          font-family: "Inter", system-ui, sans-serif;
          font-size: 14px;
        }

        .quiz-quill-wrapper .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 12px 12px 0 0;
          padding: 6px 8px;
          flex-wrap: wrap;
        }

        .quiz-quill-wrapper {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          transition: border-color 0.15s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .quiz-quill-wrapper:focus-within {
          border-color: rgb(147, 204, 255);
        }

        /* ── Editor area ─────────────────────────────────────── */
        .quiz-quill-wrapper .ql-editor {
          min-height: 90px;
          max-height: 320px;
          overflow-y: auto;
          padding: 10px 12px;
          color: #1e293b;
          line-height: 1.7;
        }

        .quiz-quill-wrapper .ql-editor.ql-blank::before {
          color: #94a3b8;
          font-style: normal;
          left: 12px;
        }

        /* ── Toolbar butonları ───────────────────────────────── */
        .quiz-quill-wrapper .ql-toolbar.ql-snow .ql-formats {
          margin-right: 6px;
        }

        .quiz-quill-wrapper .ql-snow .ql-stroke {
          stroke: #64748b;
        }
        .quiz-quill-wrapper .ql-snow .ql-fill {
          fill: #64748b;
        }
        .quiz-quill-wrapper .ql-snow .ql-picker {
          color: #64748b;
        }

        .quiz-quill-wrapper .ql-snow.ql-toolbar button:hover .ql-stroke,
        .quiz-quill-wrapper .ql-snow .ql-toolbar button:hover .ql-stroke {
          stroke: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow.ql-toolbar button.ql-active .ql-stroke,
        .quiz-quill-wrapper .ql-snow .ql-toolbar button.ql-active .ql-stroke {
          stroke: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow.ql-toolbar button:hover .ql-fill,
        .quiz-quill-wrapper .ql-snow .ql-toolbar button:hover .ql-fill {
          fill: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow.ql-toolbar button.ql-active .ql-fill,
        .quiz-quill-wrapper .ql-snow .ql-toolbar button.ql-active .ql-fill {
          fill: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow.ql-toolbar button:hover,
        .quiz-quill-wrapper .ql-snow .ql-toolbar button:hover {
          color: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow.ql-toolbar button.ql-active,
        .quiz-quill-wrapper .ql-snow .ql-toolbar button.ql-active {
          color: #1a7fe0;
        }

        /* ── Picker (header, color, align) ──────────────────── */
        .quiz-quill-wrapper .ql-snow .ql-picker-label:hover,
        .quiz-quill-wrapper .ql-snow .ql-picker-label.ql-active {
          color: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow .ql-picker-label:hover .ql-stroke,
        .quiz-quill-wrapper .ql-snow .ql-picker-label.ql-active .ql-stroke {
          stroke: #1a7fe0;
        }
        .quiz-quill-wrapper .ql-snow .ql-picker-options {
          border-radius: 8px;
          border-color: #e2e8f0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 100;
        }

        /* ── Content stilləri ────────────────────────────────── */
        .quiz-quill-wrapper .ql-editor h1 { font-size: 1.4em; font-weight: 700; margin: 0.3em 0; }
        .quiz-quill-wrapper .ql-editor h2 { font-size: 1.2em; font-weight: 700; margin: 0.3em 0; }
        .quiz-quill-wrapper .ql-editor h3 { font-size: 1.05em; font-weight: 600; margin: 0.3em 0; }
        .quiz-quill-wrapper .ql-editor blockquote {
          border-left: 3px solid rgb(147,204,255);
          padding-left: 10px;
          color: #475569;
          margin: 4px 0;
        }
        .quiz-quill-wrapper .ql-editor pre.ql-syntax {
          background: #f1f5f9;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: #334155;
        }
        .quiz-quill-wrapper .ql-editor ul,
        .quiz-quill-wrapper .ql-editor ol {
          padding-left: 1.5em;
        }
      `}</style>
    </div>
  );
}
