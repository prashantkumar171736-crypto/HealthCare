"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface MiniRichEditorProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}
// NOTE: Removed invalid hook declaration here. Slash menu state is managed by existing slashOpen, slashPos, etc. Hooks must be inside the component.

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

const SLASH_ITEMS = [
  { id: "h1", icon: "H1", label: "Heading 1", desc: "Largest header (H1)" },
  { id: "h2", icon: "H2", label: "Heading 2", desc: "Large header (H2)" },
  { id: "h3", icon: "H3", label: "Heading 3", desc: "Medium header (H3)" },
  { id: "h4", icon: "H4", label: "Heading 4", desc: "Small header (H4)" },
  { id: "h5", icon: "H5", label: "Heading 5", desc: "Smaller header (H5)" },
  { id: "h6", icon: "H6", label: "Heading 6", desc: "Tiny header (H6)" },
  { id: "h7", icon: "H7", label: "Heading 7", desc: "Micro header (H7)" },
  { id: "image", icon: "🖼️", label: "Upload Image", desc: "Upload image file" },
  { id: "table", icon: "⊞", label: "Add Table", desc: "Insert a table" },
  { id: "code", icon: "⌨️", label: "Code Block", desc: "Monospace code syntax" },
  { id: "hr", icon: "―", label: "Divider Line", desc: "Horizontal rule separator" },
  { id: "flow", icon: "📊", label: "Flow Diagram", desc: "Insert Mermaid flow chart" },
  { id: "info", icon: "ℹ️", label: "Info Callout", desc: "Blue callout box" },
  { id: "warning", icon: "⚠️", label: "Warning Callout", desc: "Yellow warning box" },
  { id: "tip", icon: "💡", label: "Tip Callout", desc: "Green tip box" },
  { id: "note", icon: "📝", label: "Note Callout", desc: "Purple note box" },
  { id: "quote", icon: "❝", label: "Blockquote", desc: "Styled blockquote quote" },
  { id: "link", icon: "🔗", label: "Insert Link", desc: "Add external hyperlink" }
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
  const savedSelRef = useRef<Range | null>(null);
  const mediaInsertRangeRef = useRef<Range | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [hoverCell, setHoverCell] = useState({ r: 0, c: 0 });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const isInitialized = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const tablePickerRef = useRef<HTMLDivElement>(null);

  // Stats and Active Formats
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);

  // Color picker popup state
  const [colorPickerOpen, setColorPickerOpen] = useState<"text" | "highlight" | null>(null);
  const [pendingColor, setPendingColor] = useState("#000000");
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorSelectionRef = useRef<Range | null>(null);
  const slashRangeRef = useRef<Range | null>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);

  // Update active formatting states based on current cursor selection
  const updateActiveFormats = useCallback(() => {
    if (typeof document === "undefined") return;
    const formats: string[] = [];
    if (document.queryCommandState("bold")) formats.push("bold");
    if (document.queryCommandState("italic")) formats.push("italic");
    if (document.queryCommandState("underline")) formats.push("underline");
    if (document.queryCommandState("strikeThrough")) formats.push("strikeThrough");
    if (document.queryCommandState("insertUnorderedList")) formats.push("insertUnorderedList");
    if (document.queryCommandState("insertOrderedList")) formats.push("insertOrderedList");
    if (document.queryCommandState("justifyLeft")) formats.push("justifyLeft");
    if (document.queryCommandState("justifyCenter")) formats.push("justifyCenter");
    if (document.queryCommandState("justifyRight")) formats.push("justifyRight");
    if (document.queryCommandState("justifyFull")) formats.push("justifyFull");
    
    try {
      const block = document.queryCommandValue("formatBlock");
      if (block) formats.push(`formatblock-${block.toLowerCase()}`);
    } catch (e) {}

    setActiveFormats(formats);
  }, []);

  // Update text stats
  const updateStats = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || "";
    const chars = text.length;
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    setWordCount(words);
    setCharCount(chars);
  }, []);

  // Initialise editor content once
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = value || "";
      isInitialized.current = true;
      updateStats();
    }
  }, []);

  // When external value changes (loading edit data), update if not focused
  useEffect(() => {
    if (editorRef.current && !isFocused) {
      editorRef.current.innerHTML = value || "";
      updateStats();
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
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        closeSlash();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    notifyChange();
    updateActiveFormats();
    updateStats();
  };

  const notifyChange = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedSelRef.current = range.cloneRange();
      }
    }
    updateActiveFormats();
  };

  const restoreSelection = (range?: Range | null) => {
    const targetRange = range || savedSelRef.current;
    if (targetRange) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(targetRange);
    }
  };

  // Helper insertions for slash items
  const insertHR = () => exec("insertHTML", `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:1.5rem 0;"/><p><br></p>`);

  const insertCodeBlock = () => exec("insertHTML",
    `<pre style="background:#0d1117;color:#7ee787;padding:1rem 1.25rem;border-radius:8px;font-family:monospace;font-size:0.9rem;overflow-x:auto;border:1px solid rgba(255,255,255,0.08);margin:1rem 0;white-space:pre-wrap;"><code>// Your code here</code></pre><p><br></p>`
  );

  const insertCallout = (type: "info" | "warning" | "tip" | "note") => {
    const styles: Record<string, { bg: string; border: string; color: string; icon: string }> = {
      info:    { bg: "rgba(59,130,246,0.1)",  border: "#3b82f6", color: "#93c5fd", icon: "ℹ️" },
      warning: { bg: "rgba(234,179,8,0.1)",   border: "#eab308", color: "#fde68a", icon: "⚠️" },
      tip:     { bg: "rgba(0,200,150,0.1)",   border: "#00c896", color: "#6ee7b7", icon: "💡" },
      note:    { bg: "rgba(168,85,247,0.1)",  border: "#a855f7", color: "#d8b4fe", icon: "📝" },
    };
    const s = styles[type];
    exec("insertHTML",
      `<div style="background:${s.bg};border-left:4px solid ${s.border};border-radius:0 8px 8px 0;padding:1rem 1.25rem;margin:1rem 0;color:${s.color};"><strong>${s.icon} ${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> Edit this callout text.</div><p><br></p>`
    );
  };

  const insertFlowDiagram = () => exec("insertHTML",
    `<div style="background:#0d1117;border:1px solid rgba(0,200,150,0.3);border-radius:8px;padding:1rem;margin:1rem 0;font-family:monospace;color:#7ee787;font-size:0.85rem;white-space:pre;">
📊 Flow Diagram:
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E[End]</div><p><br></p>`
  );

  const handleInsertLinkSlash = () => {
    saveSelection();
    setLinkUrl("");
    setShowLinkModal(true);
  };

  // ── Slash commands logic ──────────────────────────────────────────────────
  const filteredSlashItems = SLASH_ITEMS.filter(
    (it) =>
      slashQuery === "" ||
      it.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
      it.id.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const closeSlash = () => { setSlashOpen(false); setSlashQuery(""); setShowTablePicker(false); };

  const executeSlashItem = (id: string) => {
    const range = slashRangeRef.current;
    if (range) {
      restoreSelection(range);
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const node = r.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          const slashIdx2 = text.lastIndexOf("/");
          if (slashIdx2 >= 0) {
            const delRange = document.createRange();
            delRange.setStart(node, slashIdx2);
            delRange.setEnd(node, r.startOffset);
            delRange.deleteContents();
          }
        }
      }
    }
    saveSelection();
    mediaInsertRangeRef.current = savedSelRef.current;
    editorRef.current?.focus();

    switch (id) {
      case "table":   setShowTablePicker(true); return;
      case "image":   fileInputRef.current?.click(); break;
      case "code":    insertCodeBlock(); break;
      case "hr":      insertHR(); break;
      case "flow":    insertFlowDiagram(); break;
      case "info":    insertCallout("info"); break;
      case "warning": insertCallout("warning"); break;
      case "tip":     insertCallout("tip"); break;
      case "note":    insertCallout("note"); break;
      case "h1":      exec("formatBlock", "<h1>"); break;
      case "h2":      exec("formatBlock", "<h2>"); break;
      case "h3":      exec("formatBlock", "<h3>"); break;
      case "h4":      exec("formatBlock", "<h4>"); break;
      case "h5":      exec("formatBlock", "<h5>"); break;
      case "h6":      exec("formatBlock", "<h6>"); break;
      case "h7":      exec("insertHTML", `<div style="font-size:0.75rem;font-weight:700;line-height:1.4;margin:0.75rem 0 0.4rem;"><br></div>`); break;
      case "quote":   exec("formatBlock", "<blockquote>"); break;
      case "link":    handleInsertLinkSlash(); break;
    }
    closeSlash();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashOpen) {
      if (e.key === "ArrowDown")  { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, filteredSlashItems.length - 1)); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter")      { e.preventDefault(); if (filteredSlashItems[slashIdx]) executeSlashItem(filteredSlashItems[slashIdx].id); return; }
      if (e.key === "Escape")     { closeSlash(); return; }
      if (e.key === "Backspace" && slashQuery === "") { closeSlash(); return; }
    }
  };

  const handleEditorInput = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node  = range.startContainer;

    if (node.nodeType === Node.TEXT_NODE) {
      const text   = node.textContent || "";
      const offset = range.startOffset;
      const before = text.slice(0, offset);
      const slashPos2 = before.lastIndexOf("/");

      if (slashPos2 >= 0) {
        const query = before.slice(slashPos2 + 1);
        if (!query.includes(" ")) {
          const rng = range.cloneRange();
          rng.collapse(true);
          const tmpSpan = document.createElement("span");
          rng.insertNode(tmpSpan);
          const spanRect    = tmpSpan.getBoundingClientRect();
          const editorRect  = editorRef.current!.getBoundingClientRect();
          tmpSpan.remove();

          setSlashPos({
            top:  spanRect.bottom - editorRect.top  + (editorRef.current?.scrollTop || 0) + 4,
            left: Math.min(spanRect.left  - editorRect.left, editorRect.width - 260),
          });
          slashRangeRef.current = range.cloneRange();
          setSlashQuery(query);
          setSlashIdx(0);
          setShowTablePicker(false);
          setSlashOpen(true);
          return;
        }
      }
    }
    closeSlash();
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
    restoreSelection();
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
    // If the image is large (>500KB) and not a GIF, compress it before upload
    const shouldCompress = file.size > 500 * 1024 && !isGif;
    let uploadFile = file;
    if (shouldCompress) {
      // Compress using canvas
      const compressImage = (originalFile: File): Promise<File> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxWidth = 1200; // max dimension
            const scale = Math.min(maxWidth / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], originalFile.name, { type: originalFile.type, lastModified: Date.now() });
                  resolve(compressedFile);
                } else {
                  resolve(originalFile);
                }
              },
              originalFile.type,
              0.8
            );
          };
          img.onerror = () => resolve(originalFile);
          img.src = URL.createObjectURL(originalFile);
        });
      };
      uploadFile = await compressImage(file);
    }
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        insertMediaHtml(data.url, isGif);
        return;
      }
    } catch (e) {
      console.error("Image upload failed", e);
    }
    // If upload fails, show a warning (no base64 fallback to avoid huge payloads)
    alert("Failed to upload image. Please try again.");
  };

  const insertMediaHtml = (src: string, isGif: boolean) => {
    restoreSelection(mediaInsertRangeRef.current);
    editorRef.current?.focus();
    const style = isGif
      ? "max-width:100%;border-radius:8px;margin:0.5rem 0;"
      : "max-width:100%;border-radius:8px;margin:0.5rem 0;";
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${src}" alt="${isGif ? "gif" : "image"}" style="${style}" />`
    );
    mediaInsertRangeRef.current = null;
    notifyChange();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Check for direct file paste (e.g. screenshot or copied file)
    let fileImage: File | null = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        fileImage = item.getAsFile();
        break;
      }
    }

    if (fileImage) {
      e.preventDefault();
      saveSelection();
      mediaInsertRangeRef.current = savedSelRef.current;
      await handleMediaFile(fileImage);
      return;
    }

    // Check for rich text HTML containing base64 images
    const html = e.clipboardData.getData("text/html");
    if (html && html.includes("data:image/")) {
      e.preventDefault();
      saveSelection();
      mediaInsertRangeRef.current = savedSelRef.current;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const imgs = Array.from(doc.querySelectorAll("img"));

      for (const img of imgs) {
        const src = img.getAttribute("src") || "";
        if (src.startsWith("data:image/")) {
          try {
            // Convert base64 to File
            const response = await fetch(src);
            const blob = await response.blob();
            const mimeType = blob.type || "image/png";
            const ext = mimeType.split("/")[1] || "png";
            const file = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: mimeType });

            // Upload using the same logic as handleMediaFile
            const isGif = mimeType === "image/gif";
            const shouldCompress = file.size > 500 * 1024 && !isGif;
            let uploadFile = file;
            if (shouldCompress) {
              const compressImage = (originalFile: File): Promise<File> => {
                return new Promise((resolve) => {
                  const imageObj = new Image();
                  imageObj.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxWidth = 1200;
                    const scale = Math.min(maxWidth / imageObj.width, 1);
                    canvas.width = imageObj.width * scale;
                    canvas.height = imageObj.height * scale;
                    const ctx = canvas.getContext('2d');
                    if (ctx) ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(
                      (b) => {
                        if (b) {
                          resolve(new File([b], originalFile.name, { type: originalFile.type, lastModified: Date.now() }));
                        } else {
                          resolve(originalFile);
                        }
                      },
                      originalFile.type,
                      0.8
                    );
                  };
                  imageObj.onerror = () => resolve(originalFile);
                  imageObj.src = URL.createObjectURL(originalFile);
                });
              };
              uploadFile = await compressImage(file);
            }

            const formData = new FormData();
            formData.append("file", uploadFile);
            const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              img.setAttribute("src", uploadData.url);
            }
          } catch (err) {
            console.error("Failed to upload inline base64 image", err);
          }
        }
      }

      // Restore selection and insert the updated HTML
      restoreSelection(mediaInsertRangeRef.current);
      editorRef.current?.focus();
      document.execCommand("insertHTML", false, doc.body.innerHTML);
      mediaInsertRangeRef.current = null;
      notifyChange();
    }
  };

  // ── Emoji / Icon insert ──────────────────────────────────────────────────
  const insertEmoji = (emoji: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    notifyChange();
  };

  // ── Small inline icon (favicon-style) ────────────────────────────────────
  const insertInlineIcon = (emoji: string) => {
    restoreSelection();
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "26px"
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
          flexDirection: "column",
          gap: "6px",
          padding: "8px 10px",
          background: "var(--surface-alt, #f4f6f8)",
          border: "1px solid var(--border)",
          borderBottom: "none",
          borderRadius: "8px 8px 0 0",
        }}
      >
        {/* Row 1: History, Formatting, Font, Size, Colors */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px" }}>
          {/* History */}
          <Btn title="Undo" onClick={() => exec("undo")} active={false}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </Btn>
          <Btn title="Redo" onClick={() => exec("redo")} active={false}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </Btn>

          <Divider />

          {/* Text formatting */}
          <Btn title="Bold" onClick={() => exec("bold")} active={activeFormats.includes("bold")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
          </Btn>
          <Btn title="Italic" onClick={() => exec("italic")} active={activeFormats.includes("italic")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </Btn>
          <Btn title="Underline" onClick={() => exec("underline")} active={activeFormats.includes("underline")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
          </Btn>
          <Btn title="Strikethrough" onClick={() => exec("strikeThrough")} active={activeFormats.includes("strikeThrough")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6A5 5 0 0 0 8 9c0 1 .4 1.8 1.1 2.2m5.8 1.6A5 5 0 0 1 8 15"/></svg>
          </Btn>

          <Divider />

          {/* Headings dropdown H1–H7 + Paragraph */}
          <select
            title="Heading / Paragraph"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v === "p") exec("formatBlock", "<p>");
              else if (v === "h7") {
                editorRef.current?.focus();
                document.execCommand("insertHTML", false, `<div style="font-size:0.75rem;font-weight:700;line-height:1.4;margin:0.75rem 0 0.4rem;"><br></div>`);
                notifyChange();
              }
              else exec("formatBlock", `<${v}>`);
              e.target.value = "";
            }}
            defaultValue=""
            style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", fontSize: "11px", cursor: "pointer", outline: "none", height: "26px", minWidth: "72px" }}
          >
            <option value="" disabled>Heading</option>
            <option value="h1">H1 — Largest</option>
            <option value="h2">H2 — Large</option>
            <option value="h3">H3 — Medium</option>
            <option value="h4">H4 — Small</option>
            <option value="h5">H5 — Smaller</option>
            <option value="h6">H6 — Tiny</option>
            <option value="h7">H7 — Micro</option>
            <option value="p">¶ Paragraph</option>
          </select>

          <Divider />

          {/* Font size */}
          <select
            title="Font Size"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { applyFontSize(e.target.value); e.target.value = ""; }}
            defaultValue=""
            style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", fontSize: "11px", cursor: "pointer", outline: "none", height: "26px" }}
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
            style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", fontSize: "11px", cursor: "pointer", outline: "none", height: "26px" }}
          >
            <option value="" disabled>Font</option>
            {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <Divider />

          {/* Color picker triggers */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Text Color */}
            <button
              type="button"
              title="Text Color"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                colorSelectionRef.current = savedSelRef.current;
                setPendingColor("#000000");
                setColorPickerOpen("text");
              }}
              style={{
                display: "flex", alignItems: "center", gap: "3px",
                padding: "4px 7px", border: "1px solid var(--border)",
                borderRadius: "4px", background: "var(--surface)",
                cursor: "pointer", height: "26px",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 900, borderBottom: "3px solid #000", lineHeight: 1, paddingBottom: "1px" }}>A</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
            </button>

            {/* Highlight / Background Color */}
            <button
              type="button"
              title="Highlight Color"
              onMouseDown={(e) => {
                e.preventDefault();
                saveSelection();
                colorSelectionRef.current = savedSelRef.current;
                setPendingColor("#ffff00");
                setColorPickerOpen("highlight");
              }}
              style={{
                display: "flex", alignItems: "center", gap: "3px",
                padding: "4px 7px", border: "1px solid var(--border)",
                borderRadius: "4px", background: "var(--surface)",
                cursor: "pointer", height: "26px",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, background: "#ffff00", padding: "1px 4px", borderRadius: "2px", color: "#000", lineHeight: 1.4 }}>H</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
          </div>
        </div>

        {/* Row 2: Alignment, Lists, Indents, Insertions, Tables, Links, Media, Clear */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", borderTop: "1px dashed var(--border)", paddingTop: "6px" }}>
          {/* Alignment */}
          <Btn title="Align Left" onClick={() => exec("justifyLeft")} active={activeFormats.includes("justifyLeft")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
          </Btn>
          <Btn title="Align Center" onClick={() => exec("justifyCenter")} active={activeFormats.includes("justifyCenter")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
          </Btn>
          <Btn title="Align Right" onClick={() => exec("justifyRight")} active={activeFormats.includes("justifyRight")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
          </Btn>
          <Btn title="Justify" onClick={() => exec("justifyFull")} active={activeFormats.includes("justifyFull")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
          </Btn>

          <Divider />

          {/* Lists & Indents */}
          <Btn title="Bullet List" onClick={() => exec("insertUnorderedList")} active={activeFormats.includes("insertUnorderedList")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </Btn>
          <Btn title="Numbered List" onClick={() => exec("insertOrderedList")} active={activeFormats.includes("insertOrderedList")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M3 12h1v4H3m0-4v-1h1v1M3 6h2v1H3V6m0 12h2v1H3v-1z"/></svg>
          </Btn>
          <Btn title="Outdent" onClick={() => exec("outdent")} active={false}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
          </Btn>
          <Btn title="Indent" onClick={() => exec("indent")} active={false}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 14 12 9 7"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
          </Btn>

          <Divider />

          {/* Structures */}
          <Btn title="Blockquote" onClick={() => exec("formatBlock", "<blockquote>")} active={activeFormats.includes("formatblock-blockquote")}>❝</Btn>
          <Btn title="Divider Line" onClick={insertHR} active={false}>— HR</Btn>
          <Btn title="Code Block" onClick={insertCodeBlock} active={false}>&lt;/&gt;</Btn>
          <Btn title="Flow Diagram" onClick={insertFlowDiagram} active={false}>📊</Btn>
          <Btn title="Insert Link" onClick={openLinkModal} active={false}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </Btn>

          <Divider />

          {/* Media & Interactive */}
          {/* Image */}
          <div style={{ display: "inline-block" }}>
            <button
              type="button"
              title="Insert Image"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); fileInputRef.current?.click(); }}
              style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "26px", height: "26px" }}
            >
              🖼️
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); e.target.value = ""; }} />
          </div>

          {/* GIF */}
          <div style={{ display: "inline-block" }}>
            <button
              type="button"
              title="Insert GIF"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); gifInputRef.current?.click(); }}
              style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", color: "var(--text-main)", cursor: "pointer", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", minWidth: "26px", height: "26px" }}
            >
              GIF
            </button>
            <input ref={gifInputRef} type="file" accept="image/gif" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f); e.target.value = ""; }} />
          </div>

          {/* Table */}
          <div ref={tablePickerRef} style={{ position: "relative" }}>
            <button
              type="button"
              title="Insert Table"
              onMouseDown={(e) => { e.preventDefault(); setShowTablePicker(p => !p); setShowEmojiPicker(false); }}
              style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: showTablePicker ? "var(--primary)" : "var(--surface)", color: showTablePicker ? "#fff" : "var(--text-main)", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "26px", height: "26px" }}
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
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertTable(r, c)}
                        style={{ width: "20px", height: "20px", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`, background: active ? "var(--primary-light, #e0f2fe)" : "var(--background)", borderRadius: "2px", cursor: "pointer", transition: "all 0.1s" }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Emoji */}
          <div ref={pickerRef} style={{ position: "relative" }}>
            <button
              type="button"
              title="Insert Emoji"
              onMouseDown={(e) => { e.preventDefault(); setShowEmojiPicker(p => !p); setShowTablePicker(false); }}
              style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: "4px", background: showEmojiPicker ? "var(--primary)" : "var(--surface)", color: showEmojiPicker ? "#fff" : "var(--text-main)", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "26px", height: "26px" }}
            >
              😊
            </button>

            {showEmojiPicker && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", width: "300px" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-main)" }}>😊 Emoji & Icons</span>
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

          {/* Remove format */}
          <Btn title="Remove Formatting" onClick={() => exec("removeFormat")} active={false}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </Btn>
        </div>
      </div>

      {/* ── Editable area ─────────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => { setIsFocused(true); }}
          onBlur={() => { setIsFocused(false); notifyChange(); }}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onKeyDown={handleEditorKeyDown}
          onInput={(e) => { handleEditorInput(); saveSelection(); notifyChange(); }}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          style={{
            minHeight,
            padding: "14px 16px",
            border: "1px solid var(--border)",
            borderRadius: "0",
            background: "#ffffff",
            color: "#111827",
            fontSize: "14px",
            lineHeight: "1.7",
            outline: "none",
            overflowY: "auto",
            boxSizing: "border-box",
            transition: "border-color 0.2s, box-shadow 0.2s",
            boxShadow: isFocused ? "0 0 0 2px rgba(59,130,246,0.2)" : "none",
          }}
        />

        {/* ── SLASH COMMAND MENU ── */}
        {slashOpen && (
          <div ref={slashMenuRef} className="slash-menu" style={{ top: slashPos.top, left: slashPos.left }}>
            {showTablePicker ? (
              <div className="slash-table-picker">
                <div className="slash-picker-label">Select table size</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 20px)", gap: "2px" }}>
                  {Array.from({ length: 64 }, (_, i) => {
                    const r = Math.floor(i / 8) + 1;
                    const c = (i % 8) + 1;
                    const active = r <= hoverCell.r && c <= hoverCell.c;
                    return (
                      <div key={i}
                        onMouseEnter={() => setHoverCell({ r, c })}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { insertTable(r, c); closeSlash(); }}
                        style={{ width: "20px", height: "20px", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`, background: active ? "var(--primary-light, #e0f2fe)" : "var(--background)", borderRadius: "2px", cursor: "pointer", transition: "all 0.1s" }}
                      />
                    );
                  })}
                </div>
                <div className="tb-picker-size-label">{hoverCell.r} × {hoverCell.c}</div>
                <button className="slash-back-btn" onClick={() => { setShowTablePicker(false); setHoverCell({ r: 0, c: 0 }); }}>← Back</button>
              </div>
            ) : (
              <>
                <div className="slash-menu-header">Quick Insert <kbd>/</kbd></div>
                {filteredSlashItems.map((item, i) => (
                  <button
                    key={item.id}
                    className={`slash-item ${i === slashIdx ? "active" : ""}`}
                    onMouseEnter={() => setSlashIdx(i)}
                    onMouseDown={(e) => { e.preventDefault(); executeSlashItem(item.id); }}
                  >
                    <span className="slash-icon">{item.icon}</span>
                    <span className="slash-text">
                      <span className="slash-label">{item.label}</span>
                      <span className="slash-desc">{item.desc}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Stats Bar ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 12px",
          background: "var(--surface-alt, #f4f6f8)",
          border: "1px solid var(--border)",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          fontSize: "11px",
          color: "var(--text-muted)",
        }}
      >
        <span>Type <kbd style={{ background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: "3px" }}>/</kbd> for quick command insert</span>
        <div style={{ display: "flex", gap: "12px" }}>
          <span>Words: <strong>{wordCount}</strong></span>
          <span>Characters: <strong>{charCount}</strong></span>
        </div>
      </div>

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

      {/* ── Color Picker Modal ────────────────────────────────────────────── */}
      {colorPickerOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={() => setColorPickerOpen(null)}
        >
          <div
            ref={colorPickerRef}
            style={{ background: "#fff", borderRadius: "14px", padding: "24px", width: "300px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: "16px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              {colorPickerOpen === "text" ? (
                <><span style={{ fontWeight: 900, borderBottom: "3px solid currentColor", paddingBottom: "1px" }}>A</span> Text Color</>
              ) : (
                <><span style={{ background: "#ffff00", padding: "2px 5px", borderRadius: "3px", fontSize: "0.85rem" }}>H</span> Highlight Color</>
              )}
            </h3>

            {/* Color input + preview */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input
                type="color"
                value={pendingColor}
                onChange={(e) => setPendingColor(e.target.value)}
                style={{ width: "56px", height: "56px", border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer", padding: "2px", background: "#fff" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "#374151", marginBottom: "6px" }}>Preview</div>
                <div style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: colorPickerOpen === "text" ? pendingColor : "#111827",
                  background: colorPickerOpen === "highlight" ? pendingColor : "#fff",
                }}>
                  Sample Text
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>{pendingColor.toUpperCase()}</div>
              </div>
            </div>

            {/* Preset swatches */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "8px" }}>Quick Colors</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {["#000000","#111827","#374151","#6b7280","#9ca3af","#d1d5db","#ffffff",
                  "#dc2626","#ea580c","#d97706","#65a30d","#0891b2","#2563eb","#7c3aed","#db2777",
                  "#fef08a","#bbf7d0","#bfdbfe","#fca5a5","#ddd6fe"].map(c => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setPendingColor(c)}
                    style={{
                      width: "22px", height: "22px", borderRadius: "4px",
                      background: c,
                      border: pendingColor === c ? "2px solid #2563eb" : "1px solid #d1d5db",
                      cursor: "pointer", padding: 0, flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* OK / Cancel */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setColorPickerOpen(null)}
                style={{ padding: "8px 20px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#fff", color: "#374151", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Restore the saved selection and apply the color
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  if (colorSelectionRef.current) sel?.addRange(colorSelectionRef.current);
                  editorRef.current?.focus();
                  if (colorPickerOpen === "text") {
                    document.execCommand("foreColor", false, pendingColor);
                  } else {
                    document.execCommand("hiliteColor", false, pendingColor);
                  }
                  notifyChange();
                  setColorPickerOpen(null);
                }}
                style={{ padding: "8px 20px", border: "none", borderRadius: "8px", background: "#2563eb", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}
              >
                ✓ Apply
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
          border-collapse: collapse !important;
          width: 100% !important;
          margin: 0.75rem 0;
        }
        [contenteditable] table td,
        [contenteditable] table th {
          border: 1px solid #d1d5db !important;
          padding: 8px 12px !important;
          min-width: 80px !important;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        [contenteditable] ul li {
          display: list-item;
          list-style-type: disc;
        }
        [contenteditable] ol {
          list-style-type: decimal !important;
          padding-left: 2.5rem !important;
          margin: 0.5rem 0;
        }
        [contenteditable] ol li {
          display: list-item !important;
          list-style-type: decimal !important;
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
        [contenteditable] h1 { font-size: 1.8rem; font-weight: 800; margin: 1rem 0 0.5rem; }
        [contenteditable] h2 { font-size: 1.4rem; font-weight: 700; margin: 0.9rem 0 0.4rem; }
        [contenteditable] h3 { font-size: 1.15rem; font-weight: 700; margin: 0.8rem 0 0.3rem; }
        [contenteditable] h4 { font-size: 1.0rem; font-weight: 700; margin: 0.7rem 0 0.3rem; }
        [contenteditable] h5 { font-size: 0.9rem; font-weight: 700; margin: 0.6rem 0 0.25rem; }
        [contenteditable] h6 { font-size: 0.82rem; font-weight: 700; margin: 0.5rem 0 0.2rem; text-transform: uppercase; letter-spacing: 0.04em; }
        [contenteditable] h7 { display: block; font-size: 0.75rem; font-weight: 700; margin: 0.4rem 0 0.15rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }

        /* Slash Menu Styles */
        .slash-menu {
          position: absolute;
          z-index: 300;
          width: 260px;
          background: var(--surface, #fff);
          border: 1px solid var(--border, #ccc);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          overflow: hidden;
          animation: fadeSlide 0.15s ease;
        }
        .slash-menu-header {
          padding: 6px 12px;
          font-size: 11px;
          color: var(--text-muted, #6b7280);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .slash-menu-header kbd {
          display: inline-block;
          background: var(--border, #e5e7eb);
          border-radius: 4px;
          padding: 0 4px;
          font-size: 10px;
          color: var(--text-main, #374151);
          margin-left: 4px;
        }
        .slash-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.12s;
          text-align: left;
        }
        .slash-item.active, .slash-item:hover {
          background: var(--primary-light, #e0f2fe);
        }
        .slash-icon {
          font-size: 14px;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--border, #f3f4f6);
          border-radius: 6px;
          flex-shrink: 0;
        }
        .slash-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .slash-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main, #111827);
        }
        .slash-desc {
          font-size: 10px;
          color: var(--text-muted, #6b7280);
        }
        .slash-table-picker {
          padding: 10px;
        }
        .slash-picker-label {
          font-size: 11px;
          color: var(--text-muted, #6b7280);
          margin-bottom: 6px;
          font-weight: 600;
        }
        .slash-back-btn {
          margin-top: 8px;
          padding: 4px 8px;
          background: var(--border, #f3f4f6);
          border: 1px solid var(--border, #ccc);
          border-radius: 6px;
          color: var(--text-muted, #4b5563);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .slash-back-btn:hover {
          color: var(--text-main, #000);
          background: var(--primary-light, #e0f2fe);
        }
        .tb-picker-size-label {
          margin-top: 6px;
          font-size: 11px;
          color: var(--primary);
          font-weight: 700;
          text-align: center;
        }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
