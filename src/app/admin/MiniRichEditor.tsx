"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface MiniRichEditorProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

// Curated emoji / icon panel — medical, symbols, decorative
const EMOJI_GROUPS = [
  {
    group: "Medical",
    icons: ["🩺","💊","🏥","🩻","🧬","🩹","💉","🧪","🔬","🫀","🫁","🧠","🦷","👁️","🦴","🩸","🧫","🥼","🚑","❤️‍🩹"],
  },
  {
    group: "Status",
    icons: ["✅","❌","⚠️","ℹ️","❓","❗","🔴","🟠","🟡","🟢","🔵","⭕","🚫","✔️","✖️","➕","➖","🔔","📌","🏷️"],
  },
  {
    group: "Arrows & Symbols",
    icons: ["→","←","↑","↓","↗","↙","⟶","⟵","▶","◀","◆","◇","★","☆","•","▪","▸","»","«","∞"],
  },
  {
    group: "Nature & Food",
    icons: ["🌿","🍎","🥦","🥕","💧","🌞","🌙","⭐","🔥","❄️","🌱","🍃","🫚","🫐","🥑","🫘","🥗","🧄","🌾","🍵"],
  },
  {
    group: "Faces & People",
    icons: ["😊","😷","🤒","🤕","😴","🏃","🧘","💪","👨‍⚕️","👩‍⚕️","🧑‍🤝‍🧑","👴","👵","🧒","👶","🤱","🙏","👍","👎","🤝"],
  },
  {
    group: "Objects & Tech",
    icons: ["📋","📊","📈","📉","🗂️","📁","📎","🔗","⚙️","🔧","🔑","📖","📚","💡","🔍","📱","💻","🖨️","📷","🎯"],
  },
];

export default function MiniRichEditor({
  label,
  value,
  onChange,
  placeholder = "Type here...",
  minHeight = "180px",
}: MiniRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [savedSel, setSavedSel] = useState<Range | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoverCell, setHoverCell] = useState({ r: 0, c: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const isInitialized = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const tablePickerRef = useRef<HTMLDivElement>(null);

  // Initialise editor content once
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value || "";
      isInitialized.current = true;
    }
  }, []);

  // When external value changes (loading edit data), update if not focused
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value, isFocused]);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target as Node)) {
        setShowTablePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    notifyChange();
  };

  const notifyChange = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  // ── Selection helpers ─────────────────────────────────────────────────────
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

  // ── Link ─────────────────────────────────────────────────────────────────
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

  // ── Table ────────────────────────────────────────────────────────────────
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

  // ── Image/GIF upload ────────────────────────────────────────────────────
  const handleMediaFile = async (file: File) => {
    const isGif = file.type === "image/gif";
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        insertMediaHtml(data.url, isGif);
        return;
      }
    } catch {}
    // Fallback: base64
    const reader = new FileReader();
    reader.onload = (e) => insertMediaHtml(e.target?.result as string, isGif);
    reader.readAsDataURL(file);
  };

  const insertMediaHtml = (src: string, isGif: boolean) => {
    editorRef.current?.focus();
    const style = isGif
      ? "max-width:100%;border-radius:8px;margin:0.5rem 0;"
      : "max-width:100%;border-radius:8px;margin:0.5rem 0;";
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${src}" alt="${isGif ? "gif" : "image"}" style="${style}" />`
    );
    notifyChange();
  };

  // ── Emoji / Icon insert ──────────────────────────────────────────────────
  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    notifyChange();
  };

  // ── Small inline icon (favicon-style) ────────────────────────────────────
  const insertInlineIcon = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;font-size:16px;line-height:1;vertical-align:middle;">${emoji}</span>`
    );
    notifyChange();
  };

  // ── Font size ────────────────────────────────────────────────────────────
  const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];
  const FONT_FAMILIES = ["Default", "Arial", "Georgia", "Times New Roman", "Courier New", "Trebuchet MS", "Verdana"];

  const applyFontSize = (size: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = size;
      try { range.surroundContents(span); } catch {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
    } else {
      document.execCommand("fontSize", false, "7");
      editorRef.current?.querySelectorAll("font[size='7']").forEach((el) => {
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
    exec("fontName", font === "Default" ? "inherit" : font);
  };

  // ── Toolbar button helper ─────────────────────────────────────────────────
  const Btn = ({
    children, title, onClick, active = false,
  }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: "4px 7px",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        background: active ? "var(--primary)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-main)",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 600,
        minWidth: "26px",
        lineHeight: 1.4,
        transition: "background 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 3px", flexShrink: 0 }} />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <label className="field-label">{label}</label>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "3px",
          padding: "7px 10px",
          background: "var(--surface-alt, #f4f6f8)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
          alignItems: "center",
        }}
      >
        {/* Text formatting */}
        <Btn title="Bold" onClick={() => exec("bold")}><b>B</b></Btn>
        <Btn title="Italic" onClick={() => exec("italic")}><i>I</i></Btn>
        <Btn title="Underline" onClick={() => exec("underline")}><u>U</u></Btn>
        <Btn title="Strikethrough" onClick={() => exec("strikeThrough")}><s>S</s></Btn>

        <Divider />

        {/* Font size */}
        <select
          title="Font Size"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { applyFontSize(e.target.value); e.target.value = ""; }}
          defaultValue=""
          style={{ padding: "3px 5px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", fontSize: "12px", cursor: "pointer" }}
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Font family */}
        <select
          title="Font Family"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { applyFontFamily(e.target.value); e.target.value = ""; }}
          defaultValue=""
          style={{ padding: "3px 5px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", fontSize: "12px", cursor: "pointer" }}
        >
          <option value="" disabled>Font</option>
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <Divider />

        {/* Text color */}
        <label title="Text Color" style={{ display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", fontSize: "13px" }}>
          🎨
          <input type="color" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => exec("foreColor", e.target.value)}
            style={{ width: "22px", height: "22px", border: "none", padding: 0, cursor: "pointer", background: "none" }} />
        </label>

        {/* Highlight */}
        <label title="Highlight" style={{ display: "flex", alignItems: "center", gap: "2px", cursor: "pointer", fontSize: "13px" }}>
          🖊
          <input type="color" defaultValue="#ffff00" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => exec("hiliteColor", e.target.value)}
            style={{ width: "22px", height: "22px", border: "none", padding: 0, cursor: "pointer", background: "none" }} />
        </label>

        <Divider />

        {/* Lists */}
        <Btn title="Bullet List" onClick={() => exec("insertUnorderedList")}>≡</Btn>
        <Btn title="Numbered List" onClick={() => exec("insertOrderedList")}>1≡</Btn>
        <Btn title="Indent" onClick={() => exec("indent")}>→</Btn>
        <Btn title="Outdent" onClick={() => exec("outdent")}>←</Btn>

        <Divider />

        {/* Alignment */}
        <Btn title="Align Left" onClick={() => exec("justifyLeft")}>◀▬</Btn>
        <Btn title="Align Center" onClick={() => exec("justifyCenter")}>▬▬</Btn>
        <Btn title="Align Right" onClick={() => exec("justifyRight")}>▬▶</Btn>

        <Divider />

        {/* Headings */}
        <Btn title="Heading 1" onClick={() => exec("formatBlock", "<h1>")}>H1</Btn>
        <Btn title="Heading 2" onClick={() => exec("formatBlock", "<h2>")}>H2</Btn>
        <Btn title="Heading 3" onClick={() => exec("formatBlock", "<h3>")}>H3</Btn>
        <Btn title="Blockquote" onClick={() => exec("formatBlock", "<blockquote>")}>❝</Btn>

        <Divider />

        {/* Link */}
        <Btn title="Insert Link" onClick={openLinkModal}>🔗</Btn>

        {/* Image upload */}
        <>
          <button
            type="button"
            title="Insert Image"
            onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
            style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", cursor: "pointer", fontSize: "12px", lineHeight: 1.4 }}
          >
            🖼️
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); e.target.value = ""; }} />
        </>

        {/* GIF upload */}
        <>
          <button
            type="button"
            title="Insert GIF"
            onMouseDown={(e) => { e.preventDefault(); gifInputRef.current?.click(); }}
            style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", cursor: "pointer", fontSize: "12px", fontWeight: 700, lineHeight: 1.4 }}
          >
            GIF
          </button>
          <input ref={gifInputRef} type="file" accept="image/gif" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); e.target.value = ""; }} />
        </>

        {/* Table */}
        <div ref={tablePickerRef} style={{ position: "relative" }}>
          <button
            type="button"
            title="Insert Table"
            onMouseDown={(e) => { e.preventDefault(); setShowTablePicker(p => !p); setShowEmojiPicker(false); }}
            style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: showTablePicker ? "var(--primary)" : "var(--surface)", color: showTablePicker ? "#fff" : "var(--text-main)", cursor: "pointer", fontSize: "12px", lineHeight: 1.4 }}
          >
            ⊞
          </button>

          {showTablePicker && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}
              onMouseLeave={() => setHoverCell({ r: 0, c: 0 })}>
              <p style={{ margin: "0 0 7px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                {hoverCell.r > 0 ? `${hoverCell.r} × ${hoverCell.c} Table` : "Select table size"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 20px)", gap: "2px" }}>
                {Array.from({ length: 64 }, (_, i) => {
                  const r = Math.floor(i / 8) + 1;
                  const c = (i % 8) + 1;
                  const active = r <= hoverCell.r && c <= hoverCell.c;
                  return (
                    <div key={i}
                      onMouseEnter={() => setHoverCell({ r, c })}
                      onClick={() => insertTable(r, c)}
                      style={{ width: "20px", height: "20px", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`, background: active ? "var(--primary-light, #e0f2fe)" : "var(--background)", borderRadius: "2px", cursor: "pointer", transition: "all 0.1s" }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Emoji / Icon / Favicon picker */}
        <div ref={pickerRef} style={{ position: "relative" }}>
          <button
            type="button"
            title="Insert Emoji / Icon / Favicon"
            onMouseDown={(e) => { e.preventDefault(); setShowEmojiPicker(p => !p); setShowTablePicker(false); }}
            style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: showEmojiPicker ? "var(--primary)" : "var(--surface)", color: showEmojiPicker ? "#fff" : "var(--text-main)", cursor: "pointer", fontSize: "14px", lineHeight: 1.4 }}
          >
            😊
          </button>

          {showEmojiPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", width: "300px" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-main)" }}>😊 Emoji & Icons</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button type="button" title="Insert as inline icon (favicon style)"
                    style={{ fontSize: "10px", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--background)", color: "var(--text-muted)", cursor: "pointer" }}
                    onClick={() => {}}>
                    📌 Icon mode
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                {EMOJI_GROUPS.map((g, i) => (
                  <button key={i} type="button"
                    onMouseDown={(e) => { e.preventDefault(); setEmojiTab(i); }}
                    style={{ padding: "3px 8px", border: "1px solid var(--border)", borderRadius: "20px", background: emojiTab === i ? "var(--primary)" : "var(--surface)", color: emojiTab === i ? "#fff" : "var(--text-muted)", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
                    {g.group}
                  </button>
                ))}
              </div>

              {/* Icons grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: "4px", maxHeight: "180px", overflowY: "auto" }}>
                {EMOJI_GROUPS[emojiTab].icons.map((emoji, i) => (
                  <button key={i} type="button"
                    title={`Insert ${emoji}`}
                    onMouseDown={(e) => { e.preventDefault(); insertEmoji(emoji); }}
                    style={{ fontSize: "18px", padding: "4px", border: "1px solid transparent", borderRadius: "6px", background: "none", cursor: "pointer", textAlign: "center", lineHeight: 1, transition: "all 0.1s" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--primary-light, #e0f2fe)"; (e.target as HTMLElement).style.borderColor = "var(--primary)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "none"; (e.target as HTMLElement).style.borderColor = "transparent"; }}>
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Inline icon insert section */}
              <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                <p style={{ margin: "0 0 6px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>📌 Insert as small inline icon (favicon-style):</p>
                <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                  {["🩺","💊","🏥","✅","⚠️","❓","🔴","🟢","★","•","→","💡","🔗","📌","🏷️","🔬","🧬","❤️","🛡️","📖"].map((emoji, i) => (
                    <button key={i} type="button"
                      title={`Insert ${emoji} as icon`}
                      onMouseDown={(e) => { e.preventDefault(); insertInlineIcon(emoji); }}
                      style={{ fontSize: "16px", padding: "3px 5px", border: "1px solid var(--border)", borderRadius: "5px", background: "var(--background)", cursor: "pointer", lineHeight: 1 }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* Clear formatting */}
        <Btn title="Remove Formatting" onClick={() => exec("removeFormat")}>✕</Btn>
      </div>

      {/* ── Editable area ─────────────────────────────────────────────────── */}
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
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isFocused ? "0 0 0 2px rgba(var(--primary-rgb, 59,130,246), 0.15)" : "none",
        }}
      />

      {/* ── Link Modal ────────────────────────────────────────────────────── */}
      {showLinkModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setShowLinkModal(false)}>
          <div style={{ background: "var(--surface)", borderRadius: "12px", padding: "24px", width: "380px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "var(--text-main)" }}>🔗 Insert Link</h3>
            <input type="url" placeholder="https://example.com" value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") insertLink(); if (e.key === "Escape") setShowLinkModal(false); }}
              autoFocus
              style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "14px", background: "var(--background)", color: "var(--text-main)", boxSizing: "border-box", marginBottom: "16px" }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowLinkModal(false)}
                style={{ padding: "8px 18px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px" }}>
                Cancel
              </button>
              <button type="button" onClick={insertLink}
                style={{ padding: "8px 18px", border: "none", borderRadius: "8px", background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                Insert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scoped styles ────────────────────────────────────────────────── */}
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
        [contenteditable] h1 { font-size: 1.8rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        [contenteditable] h2 { font-size: 1.4rem; font-weight: 700; margin: 0.9rem 0 0.4rem; }
        [contenteditable] h3 { font-size: 1.15rem; font-weight: 600; margin: 0.8rem 0 0.3rem; }
      `}</style>
    </div>
  );
}
