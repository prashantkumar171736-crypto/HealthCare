"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface MiniRichEditorProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function MiniRichEditor({
  label,
  value,
  onChange,
  placeholder = "Type here...",
  minHeight = "180px",
}: MiniRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [savedSel, setSavedSel] = useState<Range | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoverCell, setHoverCell] = useState({ r: 0, c: 0 });
  const [isFocused, setIsFocused] = useState(false);
  const isInitialized = useRef(false);

  // Initialise editor content once (avoid cursor reset on every keystroke)
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value || "";
      isInitialized.current = true;
    }
  }, []);

  // When external value changes (e.g., loading edit data), update inner HTML
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value, isFocused]);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    notifyChange();
  };

  const notifyChange = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // ── Save / restore selection for link modal ───────────────────────────────
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) setSavedSel(sel.getRangeAt(0).cloneRange());
  };

  const restoreSelection = () => {
    if (savedSel) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSel);
    }
  };

  // ── Link insertion ────────────────────────────────────────────────────────
  const openLinkModal = () => {
    saveSelection();
    setLinkUrl("");
    setShowLinkModal(true);
  };

  const insertLink = () => {
    restoreSelection();
    if (linkUrl.trim()) exec("createLink", linkUrl.trim());
    setShowLinkModal(false);
  };

  // ── Table insertion ────────────────────────────────────────────────────────
  const insertTable = (rows: number, cols: number) => {
    editorRef.current?.focus();
    let html = `<table style="border-collapse:collapse;width:100%;margin:1rem 0;"><tbody>`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td style="border:1px solid #ccc;padding:8px 12px;min-width:80px;">${r === 0 ? `<strong>Header ${c + 1}</strong>` : "&nbsp;"}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    document.execCommand("insertHTML", false, html);
    setShowTablePicker(false);
    notifyChange();
  };

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleImageFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        editorRef.current?.focus();
        document.execCommand(
          "insertHTML",
          false,
          `<img src="${data.url}" alt="uploaded" style="max-width:100%;border-radius:8px;margin:0.5rem 0;" />`
        );
        notifyChange();
      }
    } catch {
      // fallback: insert as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        editorRef.current?.focus();
        document.execCommand(
          "insertHTML",
          false,
          `<img src="${e.target?.result}" alt="uploaded" style="max-width:100%;border-radius:8px;margin:0.5rem 0;" />`
        );
        notifyChange();
      };
      reader.readAsDataURL(file);
    }
  };

  const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];
  const FONT_FAMILIES = [
    "Default",
    "Arial",
    "Georgia",
    "Times New Roman",
    "Courier New",
    "Trebuchet MS",
    "Verdana",
  ];

  const applyFontSize = (size: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = size;
      try {
        range.surroundContents(span);
      } catch {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
    } else {
      document.execCommand("fontSize", false, "7");
      const fontEls = editorRef.current?.querySelectorAll("font[size='7']");
      fontEls?.forEach((el) => {
        const span = document.createElement("span");
        span.style.fontSize = size;
        span.innerHTML = (el as HTMLElement).innerHTML;
        el.parentNode?.replaceChild(span, el);
      });
    }
    notifyChange();
  };

  const applyFontFamily = (font: string) => {
    editorRef.current?.focus();
    if (font === "Default") {
      exec("fontName", "inherit");
    } else {
      exec("fontName", font);
    }
  };

  const toolbarBtn = (label: string, title: string, onClick: () => void, active = false) => (
    <button
      key={title}
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: "4px 8px",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        background: active ? "var(--primary)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-main)",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 600,
        minWidth: "28px",
        lineHeight: 1.4,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <label className="field-label">{label}</label>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          padding: "8px 10px",
          background: "var(--surface-alt, #f8f9fa)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
          alignItems: "center",
        }}
      >
        {/* Text style */}
        {toolbarBtn("B", "Bold", () => exec("bold"))}
        {toolbarBtn("I", "Italic", () => exec("italic"))}
        {toolbarBtn("U", "Underline", () => exec("underline"))}
        {toolbarBtn("S̶", "Strikethrough", () => exec("strikeThrough"))}

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Font size */}
        <select
          title="Font Size"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { e.preventDefault(); applyFontSize(e.target.value); e.target.value = ""; }}
          style={{
            padding: "3px 6px",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            background: "var(--surface)",
            color: "var(--text-main)",
            fontSize: "12px",
            cursor: "pointer",
          }}
          defaultValue=""
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Font family */}
        <select
          title="Font Family"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { applyFontFamily(e.target.value); e.target.value = ""; }}
          style={{
            padding: "3px 6px",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            background: "var(--surface)",
            color: "var(--text-main)",
            fontSize: "12px",
            cursor: "pointer",
          }}
          defaultValue=""
        >
          <option value="" disabled>Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Color */}
        <label title="Text Color" style={{ display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", fontSize: "12px", color: "var(--text-main)" }}>
          🎨
          <input
            type="color"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => exec("foreColor", e.target.value)}
            style={{ width: "24px", height: "24px", border: "none", padding: 0, cursor: "pointer", background: "none" }}
          />
        </label>

        {/* Highlight */}
        <label title="Highlight Color" style={{ display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", fontSize: "12px", color: "var(--text-main)" }}>
          🖊
          <input
            type="color"
            defaultValue="#ffff00"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => exec("hiliteColor", e.target.value)}
            style={{ width: "24px", height: "24px", border: "none", padding: 0, cursor: "pointer", background: "none" }}
          />
        </label>

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Lists */}
        {toolbarBtn("≡", "Unordered List", () => exec("insertUnorderedList"))}
        {toolbarBtn("1≡", "Ordered List", () => exec("insertOrderedList"))}

        {/* Indent */}
        {toolbarBtn("→", "Indent", () => exec("indent"))}
        {toolbarBtn("←", "Outdent", () => exec("outdent"))}

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Alignment */}
        {toolbarBtn("⬛L", "Align Left", () => exec("justifyLeft"))}
        {toolbarBtn("⬛C", "Align Center", () => exec("justifyCenter"))}
        {toolbarBtn("⬛R", "Align Right", () => exec("justifyRight"))}

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Link */}
        {toolbarBtn("🔗", "Insert Link", openLinkModal)}

        {/* Image upload */}
        <button
          type="button"
          title="Insert Image"
          onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
          style={{
            padding: "4px 8px",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            background: "var(--surface)",
            color: "var(--text-main)",
            cursor: "pointer",
            fontSize: "13px",
            lineHeight: 1.4,
          }}
        >
          🖼️
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
        />

        {/* Table */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            title="Insert Table"
            onMouseDown={(e) => { e.preventDefault(); setShowTablePicker((p) => !p); }}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              background: showTablePicker ? "var(--primary)" : "var(--surface)",
              color: showTablePicker ? "#fff" : "var(--text-main)",
              cursor: "pointer",
              fontSize: "13px",
              lineHeight: 1.4,
            }}
          >
            ⊞
          </button>

          {showTablePicker && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                zIndex: 100,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
              onMouseLeave={() => setHoverCell({ r: 0, c: 0 })}
            >
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                {hoverCell.r > 0 ? `${hoverCell.r} × ${hoverCell.c} Table` : "Select table size"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 20px)", gap: "2px" }}>
                {Array.from({ length: 64 }, (_, i) => {
                  const r = Math.floor(i / 8) + 1;
                  const c = (i % 8) + 1;
                  const active = r <= hoverCell.r && c <= hoverCell.c;
                  return (
                    <div
                      key={i}
                      onMouseEnter={() => setHoverCell({ r, c })}
                      onClick={() => insertTable(r, c)}
                      style={{
                        width: "20px",
                        height: "20px",
                        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "var(--primary-light, #e0f2fe)" : "var(--background)",
                        borderRadius: "2px",
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Headings */}
        {toolbarBtn("H1", "Heading 1", () => exec("formatBlock", "<h1>"))}
        {toolbarBtn("H2", "Heading 2", () => exec("formatBlock", "<h2>"))}
        {toolbarBtn("H3", "Heading 3", () => exec("formatBlock", "<h3>"))}

        {/* Blockquote */}
        {toolbarBtn("❝", "Blockquote", () => exec("formatBlock", "<blockquote>"))}

        <div style={{ width: "1px", height: "22px", background: "var(--border)", margin: "0 4px" }} />

        {/* Clear */}
        {toolbarBtn("✕", "Remove Formatting", () => exec("removeFormat"))}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => setIsFocused(true)}
        onBlur={() => { setIsFocused(false); notifyChange(); }}
        onInput={notifyChange}
        data-placeholder={placeholder}
        style={{
          minHeight,
          padding: "14px 16px",
          border: "1px solid var(--border)",
          borderRadius: "0 0 8px 8px",
          background: "var(--surface, #fff)",
          color: "var(--text-main)",
          fontSize: "14px",
          lineHeight: "1.7",
          outline: "none",
          overflowY: "auto",
          boxSizing: "border-box",
          transition: "border-color 0.2s",
        }}
      />

      {/* Placeholder CSS handled inline via :empty pseudo – fallback JS */}

      {/* Link Modal */}
      {showLinkModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowLinkModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "380px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "var(--text-main)" }}>
              🔗 Insert Link
            </h3>
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") insertLink(); if (e.key === "Escape") setShowLinkModal(false); }}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
                background: "var(--background)",
                color: "var(--text-main)",
                boxSizing: "border-box",
                marginBottom: "16px",
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                style={{
                  padding: "8px 18px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertLink}
                style={{
                  padding: "8px 18px",
                  border: "none",
                  borderRadius: "8px",
                  background: "var(--primary)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.75rem 0;
        }
        [contenteditable] table td,
        [contenteditable] table th {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          min-width: 80px;
        }
        [contenteditable] ul,
        [contenteditable] ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] blockquote {
          border-left: 4px solid var(--primary, #3b82f6);
          margin: 0.75rem 0;
          padding: 0.5rem 1rem;
          background: var(--primary-light, #eff6ff);
          border-radius: 0 8px 8px 0;
        }
        [contenteditable] img {
          max-width: 100%;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
