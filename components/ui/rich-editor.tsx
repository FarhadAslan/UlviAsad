"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  Heading1, Heading2, Heading3, Link, Minus,
} from "lucide-react";

interface RichEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichEditor({
  value,
  onChange,
  placeholder = "Məzmunu buraya yazın...",
  minHeight = 280,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Xarici value dəyişdikdə (edit mode) editor-u yenilə
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  };

  const insertLink = () => {
    const url = prompt("URL daxil edin:", "https://");
    if (url) exec("createLink", url);
  };

  const tools = [
    { icon: Bold,         title: "Qalın",       action: () => exec("bold") },
    { icon: Italic,       title: "Kursiv",       action: () => exec("italic") },
    { icon: Underline,    title: "Altı xəttli",  action: () => exec("underline") },
    null,
    { icon: Heading1,     title: "Başlıq 1",     action: () => exec("formatBlock", "<h1>") },
    { icon: Heading2,     title: "Başlıq 2",     action: () => exec("formatBlock", "<h2>") },
    { icon: Heading3,     title: "Başlıq 3",     action: () => exec("formatBlock", "<h3>") },
    null,
    { icon: List,         title: "Siyahı",       action: () => exec("insertUnorderedList") },
    { icon: ListOrdered,  title: "Nömrəli siyahı",action: () => exec("insertOrderedList") },
    null,
    { icon: Link,         title: "Link",         action: insertLink },
    { icon: Minus,        title: "Xətt sil",     action: () => exec("removeFormat") },
  ];

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>

      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-0.5 p-2 border-b border-slate-100 bg-slate-50">
        {tools.map((tool, i) =>
          tool === null ? (
            <div key={i} className="w-px h-5 bg-slate-200 mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              title={tool.title}
              onMouseDown={(e) => { e.preventDefault(); tool.action(); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white transition-all"
            >
              <tool.icon size={15} />
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
        className="rich-content outline-none p-4 text-slate-800"
        style={{ minHeight, lineHeight: 1.7 }}
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
