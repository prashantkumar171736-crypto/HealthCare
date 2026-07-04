"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import MiniRichEditor from "./MiniRichEditor";

interface Post {
  _id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

interface Disease {
  _id: string;
  name: string;
  slug: string;
  categories: string[];
  overview: string;
  symptoms: string | string[];
  causes: string | string[];
  riskFactors: string | string[];
  diagnosis: string;
  treatmentOptions: string | string[];
  prevention: string;
  faq: { q: string; a: string }[];
  relatedDiseases: string[];
}

interface LibraryItem {
  _id: string;
  title: string;
  slug: string;
  type: string;
  description: string;
  content: string;
}

interface Tip {
  _id: string;
  id?: number;
  title: string;
  category: string;
  body: string;
  icon: string;
  tag: string;
  tagColor: string;
}

interface Faq {
  _id: string;
  q: string;
  a: string;
}

const CONTENT_TYPES = [
  { id: "posts", label: "Blog Posts", icon: "📝" },
  { id: "diseases", label: "Diseases & Conditions", icon: "🤒" },
  { id: "library", label: "Health Library Resources", icon: "📚" },
  { id: "tips", label: "Health Tips", icon: "💡" },
  { id: "faq", label: "General FAQs", icon: "❓" }
];

const DISEASE_CATEGORIES = [
  { slug: "cancer", name: "Cancer" },
  { slug: "heart-diseases", name: "Heart Diseases" },
  { slug: "diabetes", name: "Diabetes" },
  { slug: "respiratory-diseases", name: "Respiratory Diseases" },
  { slug: "infectious-diseases", name: "Infectious Diseases" },
  { slug: "neurological-disorders", name: "Neurological Disorders" },
  { slug: "skin-diseases", name: "Skin Diseases" },
  { slug: "kidney-diseases", name: "Kidney Diseases" },
  { slug: "digestive-diseases", name: "Digestive Diseases" },
  { slug: "eye-diseases", name: "Eye Diseases" },
  { slug: "bone-joint-diseases", name: "Bone & Joint Diseases" },
  { slug: "blood-disorders", name: "Blood Disorders" },
  { slug: "autoimmune-diseases", name: "Autoimmune Diseases" },
  { slug: "rare-diseases", name: "Rare Diseases" }
];

const SLASH_ITEMS = [
  { id: "table",     icon: "⊞", label: "Table",       desc: "Insert a table (pick size)" },
  { id: "image",     icon: "🖼️", label: "Image",       desc: "Upload an image file" },
  { id: "gif",       icon: "🎞️", label: "GIF",         desc: "Upload an animated GIF" },
  { id: "code",      icon: "</>" , label: "Code Block",  desc: "Insert a code block" },
  { id: "hr",        icon: "—",  label: "Divider",     desc: "Horizontal rule" },
  { id: "flow",      icon: "📊", label: "Flow Diagram", desc: "Flow diagram template" },
  { id: "info",      icon: "ℹ️", label: "Info Box",    desc: "Info callout" },
  { id: "warning",   icon: "⚠️", label: "Warning Box", desc: "Warning callout" },
  { id: "tip",       icon: "💡", label: "Tip Box",     desc: "Tip callout" },
  { id: "note",      icon: "📝", label: "Note Box",    desc: "Note callout" },
  { id: "h1",        icon: "H1", label: "Heading 1",   desc: "Large heading" },
  { id: "h2",        icon: "H2", label: "Heading 2",   desc: "Medium heading" },
  { id: "h3",        icon: "H3", label: "Heading 3",   desc: "Small heading" },
  { id: "quote",     icon: "❝",  label: "Blockquote",  desc: "Quote block" },
  { id: "link",      icon: "🔗", label: "Link",        desc: "Insert hyperlink" },
];

export default function PostEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const tableCtxRef = useRef<HTMLDivElement>(null);
  const imgResizeRef = useRef<HTMLDivElement>(null);

  const [contentType, setContentType] = useState<string>("posts");
  const [activeView, setActiveView] = useState<"editor" | "posts">("editor");

  // Shared form state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // 1. Post state
  const [title, setTitle] = useState("");

  // 2. Disease state
  const [diseaseName, setDiseaseName] = useState("");
  const [diseaseCategories, setDiseaseCategories] = useState<string[]>([]);
  const [diseaseOverview, setDiseaseOverview] = useState("");
  const [diseaseSymptoms, setDiseaseSymptoms] = useState("");
  const [diseaseCauses, setDiseaseCauses] = useState("");
  const [diseaseRiskFactors, setDiseaseRiskFactors] = useState("");
  const [diseaseDiagnosis, setDiseaseDiagnosis] = useState("");
  const [diseaseTreatments, setDiseaseTreatments] = useState("");
  const [diseasePrevention, setDiseasePrevention] = useState("");
  const [diseaseRelated, setDiseaseRelated] = useState("");
  const [diseaseFaqs, setDiseaseFaqs] = useState<{ q: string; a: string }[]>([]);

  // 3. Library state
  const [libraryTitle, setLibraryTitle] = useState("");
  const [libraryType, setLibraryType] = useState("symptoms");
  const [libraryDescription, setLibraryDescription] = useState("");

  // 4. Tip state
  const [tipTitle, setTipTitle] = useState("");
  const [tipCategory, setTipCategory] = useState("nutrition");
  const [tipBody, setTipBody] = useState("");
  const [tipIcon, setTipIcon] = useState("💡");
  const [tipTag, setTipTag] = useState("");
  const [tipTagColor, setTipTagColor] = useState("#10b981");

  // 5. FAQ state
  const [faqQ, setFaqQ] = useState("");
  const [faqA, setFaqA] = useState("");

  // Link Modal & Slash Command state
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);
  const slashRangeRef = useRef<Range | null>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [pickerHover, setPickerHover] = useState({ r: 0, c: 0 });
  const [tableCtx, setTableCtx] = useState<{ top: number; left: number; cell: HTMLTableCellElement } | null>(null);
  const [imgSelected, setImgSelected] = useState<HTMLImageElement | null>(null);
  const [imgResizePos, setImgResizePos] = useState({ top: 0, left: 0, w: 0, h: 0 });
  const imgDragRef = useRef<{ startX: number; startW: number } | null>(null);

  // Fetch content list
  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/admin/content?type=${contentType}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } finally {
      setLoadingItems(false);
    }
  }, [contentType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const changeContentType = (type: string) => {
    setContentType(type);
    setEditingItem(null);
    clearForm();
    setUploadMsg(null);
  };

  const clearForm = () => {
    setTitle("");
    setDiseaseName("");
    setDiseaseCategories([]);
    setDiseaseOverview("");
    setDiseaseSymptoms("");
    setDiseaseCauses("");
    setDiseaseRiskFactors("");
    setDiseaseDiagnosis("");
    setDiseaseTreatments("");
    setDiseasePrevention("");
    setDiseaseRelated("");
    setDiseaseFaqs([]);
    setLibraryTitle("");
    setLibraryType("symptoms");
    setLibraryDescription("");
    setTipTitle("");
    setTipCategory("nutrition");
    setTipBody("");
    setTipIcon("💡");
    setTipTag("");
    setTipTagColor("#10b981");
    setFaqQ("");
    setFaqA("");
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  // ── editor helper functions ───────────────────────────────────────────────
  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) setSavedSelection(sel.getRangeAt(0).cloneRange());
  };

  const restoreSelection = (range: Range | null) => {
    if (!range) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const insertTableSized = (rows: number, cols: number) => {
    editorRef.current?.focus();
    let html = `<table style="border-collapse:collapse;width:100%;margin:1rem 0;table-layout:fixed;">`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? "th" : "td";
        const w = Math.floor(100 / cols);
        html += `<${tag} style="border:1px solid rgba(255,255,255,0.2);padding:8px 12px;width:${w}%;min-width:60px;${
          r === 0 ? "background:rgba(0,200,150,0.12);color:#00c896;font-weight:700;" : ""
        }">${r === 0 ? `Header ${c + 1}` : `Cell`}</${tag}>`;
      }
      html += "</tr>";
    }
    html += "</table><p><br></p>";
    exec("insertHTML", html);
  };

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
📊 Flow Diagram — Replace with your diagram code:

graph TD
    A[Start] --&gt; B{Decision}
    B --&gt;|Yes| C[Action 1]
    B --&gt;|No| D[Action 2]
    C --&gt; E[End]
    D --&gt; E[End]</div><p><br></p>`
  );

  const insertImageHtml = (src: string, alt = "Uploaded image") => {
    editorRef.current?.focus();
    exec("insertHTML",
      `<img src="${src}" alt="${alt}" style="max-width:100%;width:100%;border-radius:8px;margin:0.5rem 0;display:block;cursor:pointer;" data-resizable="1"/><p><br></p>`
    );
  };

  const handleInsertLink = () => { saveSelection(); setLinkUrl(""); setShowLinkModal(true); };
  const confirmLink = () => {
    restoreSelection(savedSelection);
    editorRef.current?.focus();
    const url = linkUrl.trim();
    if (url) {
      const sel = window.getSelection();
      const selectedText = sel && sel.toString() ? sel.toString() : url;
      exec("insertHTML", `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#00c896;text-decoration:underline;">${selectedText}</a>`);
    }
    setShowLinkModal(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => insertImageHtml(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleGifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => insertImageHtml(ev.target?.result as string, "Animated GIF");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Table resize & Context menu
  const getParentTable = (el: Element | null): HTMLTableElement | null => {
    let node: Element | null = el;
    while (node && node !== editorRef.current) {
      if (node.tagName === "TABLE") return node as HTMLTableElement;
      node = node.parentElement;
    }
    return null;
  };
  const getParentCell = (el: Element | null): HTMLTableCellElement | null => {
    let node: Element | null = el;
    while (node && node !== editorRef.current) {
      if (node.tagName === "TD" || node.tagName === "TH") return node as HTMLTableCellElement;
      node = node.parentElement;
    }
    return null;
  };

  const showTableContext = (cell: HTMLTableCellElement) => {
    const editorRect = editorRef.current!.getBoundingClientRect();
    const cellRect   = cell.getBoundingClientRect();
    setTableCtx({
      top:  cellRect.top  - editorRect.top  - 48,
      left: cellRect.left - editorRect.left,
      cell,
    });
  };

  const tableAction = (action: string) => {
    if (!tableCtx) return;
    const cell  = tableCtx.cell;
    const row   = cell.parentElement as HTMLTableRowElement;
    const table = getParentTable(cell)!;

    switch (action) {
      case "add-row-above": {
        const newRow = row.cloneNode(true) as HTMLTableRowElement;
        newRow.querySelectorAll("td,th").forEach((c) => { (c as HTMLElement).innerHTML = "<br>"; });
        row.parentElement!.insertBefore(newRow, row);
        break;
      }
      case "add-row-below": {
        const newRow = row.cloneNode(true) as HTMLTableRowElement;
        newRow.querySelectorAll("td,th").forEach((c) => { (c as HTMLElement).innerHTML = "<br>"; });
        row.parentElement!.insertBefore(newRow, row.nextSibling);
        break;
      }
      case "add-col-left": {
        const colIdx = Array.from(row.cells).indexOf(cell);
        table.querySelectorAll("tr").forEach((tr) => {
          const refCell = tr.cells[colIdx];
          const newCell = document.createElement(refCell?.tagName?.toLowerCase() || "td");
          newCell.style.cssText = refCell?.style?.cssText || "border:1px solid rgba(255,255,255,0.2);padding:8px 12px;";
          newCell.innerHTML = "<br>";
          tr.insertBefore(newCell, refCell);
        });
        break;
      }
      case "add-col-right": {
        const colIdx = Array.from(row.cells).indexOf(cell);
        table.querySelectorAll("tr").forEach((tr) => {
          const refCell = tr.cells[colIdx];
          const newCell = document.createElement(refCell?.tagName?.toLowerCase() || "td");
          newCell.style.cssText = refCell?.style?.cssText || "border:1px solid rgba(255,255,255,0.2);padding:8px 12px;";
          newCell.innerHTML = "<br>";
          tr.insertBefore(newCell, refCell?.nextSibling || null);
        });
        break;
      }
      case "del-row": {
        if (table.rows.length <= 1) { table.remove(); }
        else { row.remove(); }
        break;
      }
      case "del-col": {
        const colIdx = Array.from(row.cells).indexOf(cell);
        const isLast = table.rows[0]?.cells.length <= 1;
        if (isLast) { table.remove(); }
        else {
          table.querySelectorAll("tr").forEach((tr) => {
            if (tr.cells[colIdx]) tr.cells[colIdx].remove();
          });
        }
        break;
      }
      case "del-table": {
        table.remove();
        break;
      }
    }
    setTableCtx(null);
  };

  const selectImage = (img: HTMLImageElement) => {
    const editorRect = editorRef.current!.getBoundingClientRect();
    const imgRect    = img.getBoundingClientRect();
    setImgSelected(img);
    setImgResizePos({
      top:  imgRect.top  - editorRect.top  + (editorRef.current?.scrollTop || 0),
      left: imgRect.left - editorRect.left,
      w: img.offsetWidth,
      h: img.offsetHeight,
    });
  };

  const startImgDrag = (e: React.MouseEvent) => {
    if (!imgSelected) return;
    e.preventDefault();
    imgDragRef.current = { startX: e.clientX, startW: imgSelected.offsetWidth };
    const onMove = (ev: MouseEvent) => {
      if (!imgDragRef.current || !imgSelected) return;
      const delta = ev.clientX - imgDragRef.current.startX;
      const newW  = Math.max(60, imgDragRef.current.startW + delta);
      imgSelected.style.width    = newW + "px";
      imgSelected.style.maxWidth = "100%";
      const editorRect = editorRef.current!.getBoundingClientRect();
      const imgRect    = imgSelected.getBoundingClientRect();
      setImgResizePos({
        top:  imgRect.top  - editorRect.top  + (editorRef.current?.scrollTop || 0),
        left: imgRect.left - editorRect.left,
        w: imgSelected.offsetWidth,
        h: imgSelected.offsetHeight,
      });
    };
    const onUp = () => {
      imgDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const setImgWidth = (pct: number) => {
    if (!imgSelected) return;
    imgSelected.style.width = pct + "%";
    imgSelected.style.maxWidth = "100%";
    requestAnimationFrame(() => {
      if (!imgSelected || !editorRef.current) return;
      const editorRect = editorRef.current.getBoundingClientRect();
      const imgRect    = imgSelected.getBoundingClientRect();
      setImgResizePos({
        top:  imgRect.top  - editorRect.top  + (editorRef.current.scrollTop || 0),
        left: imgRect.left - editorRect.left,
        w: imgSelected.offsetWidth,
        h: imgSelected.offsetHeight,
      });
    });
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      e.preventDefault();
      selectImage(target as HTMLImageElement);
      return;
    }
    if (imgSelected && target.tagName !== "IMG") {
      setImgSelected(null);
    }
    const cell = getParentCell(target);
    if (cell) {
      const rect = cell.getBoundingClientRect();
      const nearRight = e.clientX > rect.right - 8;
      if (nearRight) {
        e.preventDefault();
        const startX   = e.clientX;
        const startW   = cell.offsetWidth;
        const onMove = (ev: MouseEvent) => {
          const newW = Math.max(40, startW + (ev.clientX - startX));
          cell.style.width = newW + "px";
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return;
      }
      showTableContext(cell);
    } else {
      setTableCtx(null);
    }
  };

  // Slash commands logic
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
    editorRef.current?.focus();

    switch (id) {
      case "table":   setShowTablePicker(true); return;
      case "image":   fileInputRef.current?.click(); break;
      case "gif":     gifInputRef.current?.click(); break;
      case "code":    insertCodeBlock(); break;
      case "hr":      insertHR(); break;
      case "flow":    insertFlowDiagram(); break;
      case "info":    insertCallout("info"); break;
      case "warning": insertCallout("warning"); break;
      case "tip":     insertCallout("tip"); break;
      case "note":    insertCallout("note"); break;
      case "h1":      exec("formatBlock", "h1"); break;
      case "h2":      exec("formatBlock", "h2"); break;
      case "h3":      exec("formatBlock", "h3"); break;
      case "quote":   exec("formatBlock", "blockquote"); break;
      case "link":    handleInsertLink(); break;
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
            left: Math.min(spanRect.left  - editorRect.left, editorRect.width - 300),
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        closeSlash();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── SAVE & UPDATE HANDLERS ────────────────────────────────────────────────
  const preparePayload = () => {
    const content = editorRef.current?.innerHTML || "";
    switch (contentType) {
      case "posts":
        return { title: title.trim(), content };
      case "diseases":
        return {
          name: diseaseName.trim(),
          categories: diseaseCategories,
          overview: diseaseOverview,
          symptoms: diseaseSymptoms,
          causes: diseaseCauses,
          riskFactors: diseaseRiskFactors,
          diagnosis: diseaseDiagnosis,
          treatmentOptions: diseaseTreatments,
          prevention: diseasePrevention,
          faq: diseaseFaqs.filter(f => f.q.trim() && f.a.trim()),
          relatedDiseases: diseaseRelated.replace(/<[^>]*>/g, "").split(",").map(s => s.trim()).filter(Boolean),
        };
      case "library":
        return {
          title: libraryTitle.trim(),
          type: libraryType,
          description: libraryDescription.trim(),
          content: content,
        };
      case "tips":
        return {
          title: tipTitle.trim(),
          category: tipCategory,
          body: tipBody.trim(),
          icon: tipIcon.trim(),
          tag: tipTag.trim(),
          tagColor: tipTagColor.trim(),
        };
      case "faq":
        return {
          q: faqQ.trim(),
          a: faqA.trim(),
        };
      default:
        return {};
    }
  };

  const handleUpload = async () => {
    const payload = preparePayload();
    
    // Simple Validation
    if (contentType === "posts" && (!title.trim() || !(payload as any).content)) {
      setUploadMsg({ type: "error", text: "Title and content are required." });
      return;
    }
    if (contentType === "diseases" && !diseaseName.trim()) {
      setUploadMsg({ type: "error", text: "Disease Name is required." });
      return;
    }
    if (contentType === "library" && (!libraryTitle.trim() || !(payload as any).content)) {
      setUploadMsg({ type: "error", text: "Title and resource content are required." });
      return;
    }
    const tipBodyText = tipBody.replace(/<[^>]*>/g, "").trim();
    if (contentType === "tips" && (!tipTitle.trim() || !tipBodyText)) {
      setUploadMsg({ type: "error", text: "Tip title and body details are required." });
      return;
    }
    if (contentType === "faq" && (!faqQ.trim() || !faqA.trim())) {
      setUploadMsg({ type: "error", text: "Question and Answer are required." });
      return;
    }

    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await fetch(`/api/admin/content?type=${contentType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({ type: "success", text: "✅ Content published successfully!" });
        clearForm();
        fetchItems();
      } else {
        setUploadMsg({ type: "error", text: data.error || "Upload failed." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    const payload = preparePayload();

    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await fetch(`/api/admin/content?type=${contentType}&id=${editingItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({ type: "success", text: "✅ Content updated successfully!" });
        setEditingItem(null);
        clearForm();
        fetchItems();
      } else {
        setUploadMsg({ type: "error", text: data.error || "Update failed." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item permanently?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content?type=${contentType}&id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((p) => p._id !== id));
      } else {
        alert("Deletion failed.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditInit = (item: any) => {
    setEditingItem(item);
    setActiveView("editor");
    setUploadMsg(null);

    // Populate form fields based on collection
    if (contentType === "posts") {
      setTitle(item.title);
      setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = item.content; }, 50);
    } else if (contentType === "diseases") {
      setDiseaseName(item.name || "");
      setDiseaseCategories(item.categories || []);
      setDiseaseOverview(item.overview || "");
      // Load: support both old string[] and new HTML string formats
      const toHtml = (val: string | string[]) =>
        typeof val === "string" ? val : (val || []).map(v => `<li>${v}</li>`).join("") ? `<ul>${(val || []).map(v => `<li>${v}</li>`).join("")}</ul>` : "";
      setDiseaseSymptoms(toHtml(item.symptoms));
      setDiseaseCauses(toHtml(item.causes));
      setDiseaseRiskFactors(toHtml(item.riskFactors));
      setDiseaseDiagnosis(item.diagnosis || "");
      setDiseaseTreatments(toHtml(item.treatmentOptions));
      setDiseasePrevention(item.prevention || "");
      setDiseaseRelated((item.relatedDiseases || []).join(", "));
      setDiseaseFaqs(item.faq || []);
    } else if (contentType === "library") {
      setLibraryTitle(item.title || "");
      setLibraryType(item.type || "symptoms");
      setLibraryDescription(item.description || "");
      setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = item.content || ""; }, 50);
    } else if (contentType === "tips") {
      setTipTitle(item.title || "");
      setTipCategory(item.category || "nutrition");
      setTipBody(item.body || "");
      setTipIcon(item.icon || "💡");
      setTipTag(item.tag || "");
      setTipTagColor(item.tagColor || "#10b981");
    } else if (contentType === "faq") {
      setFaqQ(item.q || "");
      setFaqA(item.a || "");
    }
  };

  // Group items helper for Published view
  const getGroupedItems = () => {
    if (contentType === "posts") {
      const groups: { [key: string]: Post[] } = {};
      items.forEach((p) => {
        const key = p.category || "#";
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });
      return groups;
    }
    if (contentType === "diseases") {
      const groups: { [key: string]: Disease[] } = {};
      items.forEach((d) => {
        const first = d.name ? d.name.trim()[0].toUpperCase() : "#";
        const key = /^[A-Z]$/.test(first) ? first : "#";
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
      });
      return groups;
    }
    if (contentType === "library") {
      const groups: { [key: string]: LibraryItem[] } = {
        symptoms: [],
        tests: [],
        treatments: []
      };
      items.forEach((item) => {
        const key = item.type || "symptoms";
        if (groups[key]) groups[key].push(item);
      });
      return groups;
    }
    if (contentType === "tips") {
      const groups: { [key: string]: Tip[] } = {
        nutrition: [],
        fitness: [],
        mental: [],
        sleep: [],
        prevention: [],
        hydration: []
      };
      items.forEach((item) => {
        const key = item.category || "nutrition";
        if (groups[key]) groups[key].push(item);
      });
      return groups;
    }
    return { all: items }; // faq uses a single list
  };

  const grouped = getGroupedItems() as { [key: string]: any[] };
  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  const toggleCategory = (slug: string) => {
    setDiseaseCategories(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const addDiseaseFaq = () => {
    setDiseaseFaqs(prev => [...prev, { q: "", a: "" }]);
  };

  const updateDiseaseFaq = (index: number, key: "q" | "a", val: string) => {
    setDiseaseFaqs(prev => {
      const copy = [...prev];
      copy[index][key] = val;
      return copy;
    });
  };

  const removeDiseaseFaq = (index: number) => {
    setDiseaseFaqs(prev => prev.filter((_, i) => i !== index));
  };

  const getLibraryTypeLabel = (type: string) => {
    switch (type) {
      case "symptoms": return "🤒 Symptoms Guides";
      case "tests": return "🧪 Medical Tests";
      case "treatments": return "💊 Treatment Guides";
      default: return type;
    }
  };

  const getTipCategoryLabel = (cat: string) => {
    switch (cat) {
      case "nutrition": return "🥗 Nutrition";
      case "fitness": return "🏃 Fitness";
      case "mental": return "🧠 Mental Health";
      case "sleep": return "😴 Sleep Hygiene";
      case "prevention": return "🛡️ Disease Prevention";
      case "hydration": return "💧 Hydration";
      default: return cat;
    }
  };

  return (
    <>
      <div className="post-editor-root">
        {/* Content Type Tabs */}
        <div className="content-type-nav">
          {CONTENT_TYPES.map((type) => (
            <button
              key={type.id}
              className={`type-tab-btn ${contentType === type.id ? "active" : ""}`}
              onClick={() => changeContentType(type.id)}
            >
              <span className="type-icon">{type.icon}</span> {type.label}
            </button>
          ))}
        </div>

        {/* View toggle (Write vs View Published) */}
        <div className="editor-view-toggle">
          <button className={`toggle-btn ${activeView === "editor" ? "active" : ""}`} onClick={() => setActiveView("editor")}>
            ✏️ {editingItem ? "Edit Content" : "Create Content"}
          </button>
          <button className={`toggle-btn ${activeView === "posts" ? "active" : ""}`} onClick={() => { setActiveView("posts"); fetchItems(); }}>
            📚 Published List
            {items.length > 0 && <span className="post-count-badge">{items.length}</span>}
          </button>
        </div>

        {/* ── EDITOR PANEL ── */}
        {activeView === "editor" && (
          <div className="editor-panel">
            {editingItem && (
              <div className="edit-mode-banner">
                <span>✏️ Editing: <strong>{editingItem.title || editingItem.name || editingItem.q || "Selected Item"}</strong></span>
                <button className="btn-cancel-edit" onClick={() => { setEditingItem(null); clearForm(); setUploadMsg(null); }}>✕ Cancel Edit</button>
              </div>
            )}

            <div className="editor-section-header">
              <div className="editor-section-icon">{editingItem ? "✏️" : "➕"}</div>
              <div>
                <h2 className="editor-section-title">
                  {editingItem ? "Modify" : "Add New"}{" "}
                  {CONTENT_TYPES.find(c => c.id === contentType)?.label}
                </h2>
                <p className="editor-section-sub">Fill out the fields below. Pre-formatted styles can be added with slash commands.</p>
              </div>
            </div>

            {/* DYNAMIC FORMS BASED ON CONTENT TYPE */}

            {/* 1. BLOG POST FORM */}
            {contentType === "posts" && (
              <div className="form-fields">
                <div className="title-field-wrapper">
                  <label htmlFor="post-title-input" className="field-label">📌 Post Title</label>
                  <input id="post-title-input" type="text" className="post-title-input" placeholder="Enter post title..." value={title} onChange={(e) => setTitle(e.target.value)} />
                  {title.trim() && (
                    <div className="title-category-preview">
                      Category Letter: <span className="category-chip">{/^[A-Za-z]/.test(title.trim()) ? title.trim()[0].toUpperCase() : "#"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. DISEASES & CONDITIONS FORM */}
            {contentType === "diseases" && (
              <div className="form-fields grid-fields">
                <div className="title-field-wrapper full-width">
                  <label className="field-label">🤒 Disease Name</label>
                  <input type="text" className="post-title-input" placeholder="e.g. Heart Attack, Breast Cancer..." value={diseaseName} onChange={(e) => setDiseaseName(e.target.value)} />
                </div>

                <div className="full-width">
                  <label className="field-label">📂 Medical Categories</label>
                  <div className="categories-grid">
                    {DISEASE_CATEGORIES.map(cat => (
                      <button
                        key={cat.slug}
                        type="button"
                        className={`cat-pill-btn ${diseaseCategories.includes(cat.slug) ? "active" : ""}`}
                        onClick={() => toggleCategory(cat.slug)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>


                <div className="full-width">
                  <MiniRichEditor
                    label="📖 1. Overview"
                    value={diseaseOverview}
                    onChange={setDiseaseOverview}
                    placeholder="Describe this disease — background, clinical details, who it affects..."
                    minHeight="200px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="🤒 2. Symptoms"
                    value={diseaseSymptoms}
                    onChange={setDiseaseSymptoms}
                    placeholder="Describe symptoms — use lists, bold, tables, images..."
                    minHeight="200px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="🧬 3. Causes & Risks"
                    value={diseaseCauses}
                    onChange={setDiseaseCauses}
                    placeholder="Describe causes and risk factors — use lists, bold, tables..."
                    minHeight="200px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="🛡️ 4. Risk Factors"
                    value={diseaseRiskFactors}
                    onChange={setDiseaseRiskFactors}
                    placeholder="List risk factors — use ordered/unordered lists, bold..."
                    minHeight="180px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="💊 5. Treatment Options"
                    value={diseaseTreatments}
                    onChange={setDiseaseTreatments}
                    placeholder="Describe treatments — use lists, headings, tables..."
                    minHeight="200px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="🔍 6. Diagnosis & Tests"
                    value={diseaseDiagnosis}
                    onChange={setDiseaseDiagnosis}
                    placeholder="Describe diagnostic tests — use tables, bold, lists..."
                    minHeight="200px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="🛡️ 7. Prevention Strategies"
                    value={diseasePrevention}
                    onChange={setDiseasePrevention}
                    placeholder="How to prevent this condition? e.g. Regular exercise, balanced diet..."
                    minHeight="200px"
                  />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="🔗 Related Disease Slugs (Comma-separated)"
                    value={diseaseRelated}
                    onChange={setDiseaseRelated}
                    placeholder="e.g. lung-cancer, asthma, bronchitis..."
                    minHeight="100px"
                  />
                </div>

                {/* Disease FAQs section */}
                <div className="full-width faq-builder-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <label className="field-label" style={{ margin: 0 }}>❓ FAQs Builder</label>
                    <button type="button" className="btn-add-faq" onClick={addDiseaseFaq}>➕ Add FAQ Item</button>
                  </div>
                  {diseaseFaqs.map((faq, idx) => (
                    <div key={idx} className="faq-builder-row">
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <input type="text" className="faq-row-input" placeholder={`Question ${idx + 1}`} value={faq.q} onChange={(e) => updateDiseaseFaq(idx, "q", e.target.value)} />
                        <textarea className="faq-row-textarea" placeholder="Answer text..." value={faq.a} onChange={(e) => updateDiseaseFaq(idx, "a", e.target.value)} />
                      </div>
                      <button type="button" className="btn-remove-faq" onClick={() => removeDiseaseFaq(idx)}>🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. HEALTH LIBRARY RESOURCE FORM */}
            {contentType === "library" && (
              <div className="form-fields">
                <div className="title-field-wrapper">
                  <label className="field-label">📚 Resource Title</label>
                  <input type="text" className="post-title-input" placeholder="e.g. Chest Pain Guide, CBC Test..." value={libraryTitle} onChange={(e) => setLibraryTitle(e.target.value)} />
                </div>

                <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem" }}>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">🗂️ Resource Category</label>
                    <select className="tb-select tb-select-wide" style={{ width: "100%", padding: "0.85rem 1rem", height: "auto" }} value={libraryType} onChange={(e) => setLibraryType(e.target.value)}>
                      <option value="symptoms">Symptoms Guides</option>
                      <option value="tests">Medical Tests</option>
                      <option value="treatments">Treatment Guides</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="field-label">📝 Brief Description</label>
                  <textarea className="form-textarea" style={{ minHeight: "100px" }} placeholder="Short summary of this guide..." value={libraryDescription} onChange={(e) => setLibraryDescription(e.target.value)} />
                </div>
              </div>
            )}

            {/* 4. HEALTH TIPS FORM */}
            {contentType === "tips" && (
              <div className="form-fields grid-fields">
                <div className="full-width">
                  <label className="field-label">💡 Tip Title</label>
                  <input type="text" className="post-title-input" placeholder="e.g. Walk at Least 10,000 Steps Daily..." value={tipTitle} onChange={(e) => setTipTitle(e.target.value)} />
                </div>

                <div>
                  <label className="field-label">🗂️ Tip Category</label>
                  <select className="tb-select tb-select-wide" style={{ width: "100%", padding: "0.85rem 1rem", height: "auto" }} value={tipCategory} onChange={(e) => setTipCategory(e.target.value)}>
                    <option value="nutrition">Nutrition 🥗</option>
                    <option value="fitness">Fitness 🏃</option>
                    <option value="mental">Mental Health 🧠</option>
                    <option value="sleep">Sleep 😴</option>
                    <option value="prevention">Prevention 🛡️</option>
                    <option value="hydration">Hydration 💧</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">🎭 Category Tag Label</label>
                  <input type="text" className="post-title-input" placeholder="e.g. Nutrition, Sleep..." value={tipTag} onChange={(e) => setTipTag(e.target.value)} />
                </div>

                <div>
                  <label className="field-label">🎨 Tag Border/Text Color</label>
                  <input type="color" style={{ width: "100%", height: "48px", background: "none", border: "none", cursor: "pointer" }} value={tipTagColor} onChange={(e) => setTipTagColor(e.target.value)} />
                </div>

                <div>
                  <label className="field-label">😀 Emoji Icon</label>
                  <input type="text" className="post-title-input" placeholder="e.g. 🥦, 🏃, 💧" value={tipIcon} onChange={(e) => setTipIcon(e.target.value)} />
                </div>

                <div className="full-width">
                  <MiniRichEditor
                    label="📝 Tip Details & Explanation"
                    value={tipBody}
                    onChange={setTipBody}
                    placeholder="Provide evidence-based instructions — use bold, lists, images, tables..."
                    minHeight="220px"
                  />
                </div>
              </div>
            )}

            {/* 5. GENERAL FAQs FORM */}
            {contentType === "faq" && (
              <div className="form-fields">
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="field-label">❓ FAQ Question</label>
                  <input type="text" className="post-title-input" placeholder="e.g. Is the information really free?" value={faqQ} onChange={(e) => setFaqQ(e.target.value)} />
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="field-label">📝 FAQ Answer</label>
                  <textarea className="form-textarea large-textarea" placeholder="Detailed answer description..." value={faqA} onChange={(e) => setFaqA(e.target.value)} />
                </div>
              </div>
            )}

            {/* RICH TEXT EDITOR (rendered for Posts & Library Resources only) */}
            {(contentType === "posts" || contentType === "library") && (
              <>
                <label className="field-label">📝 Content Body</label>
                {/* Editor Toolbar */}
                <div className="editor-toolbar" id="editor-toolbar">
                  <div className="toolbar-group">
                    <button title="Bold (Ctrl+B)" onClick={() => exec("bold")} className="tb-btn" id="tb-bold"><b>B</b></button>
                    <button title="Italic (Ctrl+I)" onClick={() => exec("italic")} className="tb-btn" id="tb-italic"><i>I</i></button>
                    <button title="Underline (Ctrl+U)" onClick={() => exec("underline")} className="tb-btn" id="tb-underline"><u>U</u></button>
                    <button title="Strikethrough" onClick={() => exec("strikeThrough")} className="tb-btn" id="tb-strike"><s>S</s></button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button title="Heading 1" onClick={() => exec("formatBlock", "h1")} className="tb-btn" id="tb-h1">H1</button>
                    <button title="Heading 2" onClick={() => exec("formatBlock", "h2")} className="tb-btn" id="tb-h2">H2</button>
                    <button title="Heading 3" onClick={() => exec("formatBlock", "h3")} className="tb-btn" id="tb-h3">H3</button>
                    <button title="Paragraph" onClick={() => exec("formatBlock", "p")} className="tb-btn" id="tb-p">¶</button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <select className="tb-select" id="tb-fontsize" defaultValue="" onChange={(e) => { if (e.target.value) exec("fontSize", e.target.value); e.target.value = ""; }} title="Font Size">
                      <option value="" disabled>Size</option>
                      {["1","2","3","4","5","6","7"].map((s) => (<option key={s} value={s}>{["8px","10px","12px","14px","18px","24px","36px"][+s - 1]}</option>))}
                    </select>
                    <select className="tb-select tb-select-wide" id="tb-fontname" defaultValue="" onChange={(e) => { if (e.target.value) exec("fontName", e.target.value); e.target.value = ""; }} title="Font Family">
                      <option value="" disabled>Font</option>
                      {["Arial","Georgia","Courier New","Times New Roman","Verdana","Trebuchet MS","Impact","Comic Sans MS"].map((f) => (<option key={f} value={f} style={{ fontFamily: f }}>{f}</option>))}
                    </select>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <label className="tb-color-label" title="Text Color"><span className="tb-color-icon">A</span><input type="color" defaultValue="#ffffff" id="tb-forecolor" className="tb-color-input" onChange={(e) => exec("foreColor", e.target.value)} /></label>
                    <label className="tb-color-label" title="Highlight Color"><span className="tb-color-icon tb-hl-icon">◼</span><input type="color" defaultValue="#ffff00" id="tb-hilite" className="tb-color-input" onChange={(e) => exec("hiliteColor", e.target.value)} /></label>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button title="Align Left" onClick={() => exec("justifyLeft")} className="tb-btn" id="tb-align-left">⬅️</button>
                    <button title="Align Center" onClick={() => exec("justifyCenter")} className="tb-btn" id="tb-align-center">↔️</button>
                    <button title="Align Right" onClick={() => exec("justifyRight")} className="tb-btn" id="tb-align-right">➡️</button>
                    <button title="Justify" onClick={() => exec("justifyFull")} className="tb-btn" id="tb-justify">≡</button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button title="Bullet List" onClick={() => exec("insertUnorderedList")} className="tb-btn" id="tb-ul">• List</button>
                    <button title="Numbered List" onClick={() => exec("insertOrderedList")} className="tb-btn" id="tb-ol">1. List</button>
                    <button title="Blockquote" onClick={() => exec("formatBlock", "blockquote")} className="tb-btn" id="tb-quote">❝</button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group" style={{ position: "relative" }}>
                    <div className="tb-table-wrap">
                      <button title="Insert Table (pick size)" className="tb-btn" id="tb-table">⊞ Table ▾</button>
                      <div className="tb-table-picker-popup">
                        <div className="tb-picker-label">Drag to select table size</div>
                        <div className="tb-size-grid">
                          {Array.from({ length: 8 }, (_, r) =>
                            Array.from({ length: 8 }, (_, c) => (
                              <div
                                key={`${r}-${c}`}
                                className={`tb-size-cell ${r <= pickerHover.r && c <= pickerHover.c ? "active" : ""}`}
                                onMouseEnter={() => setPickerHover({ r, c })}
                                onClick={() => { insertTableSized(pickerHover.r + 1, pickerHover.c + 1); setPickerHover({ r: 0, c: 0 }); }}
                              />
                            ))
                          )}
                        </div>
                        <div className="tb-picker-size-label">{pickerHover.r + 1} × {pickerHover.c + 1}</div>
                      </div>
                    </div>
                    <button title="Insert Link" onClick={handleInsertLink} className="tb-btn" id="tb-link">🔗 Link</button>
                    <button title="Insert Image" onClick={() => fileInputRef.current?.click()} className="tb-btn" id="tb-image">🖼️ Image</button>
                    <button title="Insert Animated GIF" onClick={() => gifInputRef.current?.click()} className="tb-btn" id="tb-gif">🎞️ GIF</button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button title="Code Block" onClick={insertCodeBlock} className="tb-btn" id="tb-code">&lt;/&gt; Code</button>
                    <button title="Divider Line" onClick={insertHR} className="tb-btn" id="tb-hr">— HR</button>
                    <button title="Flow Diagram" onClick={insertFlowDiagram} className="tb-btn" id="tb-flow">📊 Flow</button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button title="Info Callout" onClick={() => insertCallout("info")} className="tb-btn tb-callout-info" id="tb-callout-info">ℹ️</button>
                    <button title="Tip Callout" onClick={() => insertCallout("tip")} className="tb-btn tb-callout-tip" id="tb-callout-tip">💡</button>
                    <button title="Warning Callout" onClick={() => insertCallout("warning")} className="tb-btn tb-callout-warn" id="tb-callout-warn">⚠️</button>
                    <button title="Note Callout" onClick={() => insertCallout("note")} className="tb-btn tb-callout-note" id="tb-callout-note">📝</button>
                  </div>
                  <div className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button title="Undo (Ctrl+Z)" onClick={() => exec("undo")} className="tb-btn" id="tb-undo">↩ Undo</button>
                    <button title="Redo (Ctrl+Y)" onClick={() => exec("redo")} className="tb-btn" id="tb-redo">↪ Redo</button>
                    <button title="Clear Formatting" onClick={() => exec("removeFormat")} className="tb-btn" id="tb-clearfmt">✕ Clear</button>
                  </div>
                </div>

                {/* Editor Container */}
                <div style={{ position: "relative" }}>
                  <div
                    ref={editorRef}
                    id="post-content-editor"
                    className="post-content-editor"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Start writing... or type / for quick-insert options (table, image, code, callouts, headings...)"
                    spellCheck
                    onMouseDown={handleEditorMouseDown}
                    onKeyDown={handleEditorKeyDown}
                    onInput={handleEditorInput}
                  />

                  {/* ── TABLE CONTEXT TOOLBAR ── */}
                  {tableCtx && (
                    <div
                      ref={tableCtxRef}
                      className="table-ctx-toolbar"
                      style={{ top: Math.max(0, tableCtx.top), left: tableCtx.left }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <span className="tbl-ctx-label">Table:</span>
                      <button className="tbl-ctx-btn" onClick={() => tableAction("add-row-above")} title="Add row above">↑ Row</button>
                      <button className="tbl-ctx-btn" onClick={() => tableAction("add-row-below")} title="Add row below">↓ Row</button>
                      <button className="tbl-ctx-btn" onClick={() => tableAction("add-col-left")}  title="Add column left">← Col</button>
                      <button className="tbl-ctx-btn" onClick={() => tableAction("add-col-right")} title="Add column right">→ Col</button>
                      <div className="tbl-ctx-sep" />
                      <button className="tbl-ctx-btn tbl-ctx-del" onClick={() => tableAction("del-row")} title="Delete row">✕ Row</button>
                      <button className="tbl-ctx-btn tbl-ctx-del" onClick={() => tableAction("del-col")} title="Delete column">✕ Col</button>
                      <button className="tbl-ctx-btn tbl-ctx-del-all" onClick={() => tableAction("del-table")} title="Delete entire table">🗑️ Table</button>
                    </div>
                  )}

                  {/* ── IMAGE RESIZE OVERLAY ── */}
                  {imgSelected && (
                    <div
                      ref={imgResizeRef}
                      className="img-resize-overlay"
                      style={{ top: imgResizePos.top, left: imgResizePos.left, width: imgResizePos.w, height: imgResizePos.h }}
                    >
                      <div className="img-resize-handle" onMouseDown={startImgDrag} title="Drag to resize" />
                      <div className="img-resize-toolbar">
                        <span className="img-size-label">{Math.round(imgResizePos.w)}px</span>
                        <button className="img-sz-btn" onClick={() => setImgWidth(25)}>25%</button>
                        <button className="img-sz-btn" onClick={() => setImgWidth(50)}>50%</button>
                        <button className="img-sz-btn" onClick={() => setImgWidth(75)}>75%</button>
                        <button className="img-sz-btn" onClick={() => setImgWidth(100)}>100%</button>
                        <button className="img-sz-btn img-sz-del" onClick={() => { imgSelected.remove(); setImgSelected(null); }} title="Delete image">🗑️</button>
                      </div>
                    </div>
                  )}

                  {/* ── SLASH COMMAND MENU ── */}
                  {slashOpen && (
                    <div ref={slashMenuRef} className="slash-menu" style={{ top: slashPos.top, left: slashPos.left }}>
                      {showTablePicker ? (
                        <div className="slash-table-picker">
                          <div className="slash-picker-label">Select table size</div>
                          <div className="tb-size-grid">
                            {Array.from({ length: 8 }, (_, r) =>
                              Array.from({ length: 8 }, (_, c) => (
                                <div
                                  key={`${r}-${c}`}
                                  className={`tb-size-cell ${r <= pickerHover.r && c <= pickerHover.c ? "active" : ""}`}
                                  onMouseEnter={() => setPickerHover({ r, c })}
                                  onClick={() => { insertTableSized(pickerHover.r + 1, pickerHover.c + 1); setPickerHover({ r: 0, c: 0 }); closeSlash(); }}
                                />
                              ))
                            )}
                          </div>
                          <div className="tb-picker-size-label">{pickerHover.r + 1} × {pickerHover.c + 1}</div>
                          <button className="slash-back-btn" onClick={() => setShowTablePicker(false)}>← Back</button>
                        </div>
                      ) : (
                        <>
                          <div className="slash-menu-header">Quick Insert <kbd>/</kbd></div>
                          {filteredSlashItems.length === 0 ? (
                            <div className="slash-empty">No match for "{slashQuery}"</div>
                          ) : (
                            filteredSlashItems.map((item, i) => (
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
                            ))
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="editor-stats-bar">
                  <span>Type <kbd>/</kbd> anywhere to quick-insert • Click table cell for row/col controls • Click image to resize</span>
                </div>
              </>
            )}

            {/* Feedback & Actions */}
            {uploadMsg && (<div className={`upload-feedback ${uploadMsg.type}`} id="upload-feedback" style={{ marginTop: "1rem" }}>{uploadMsg.text}</div>)}

            <div className="editor-actions" style={{ marginTop: "1.5rem" }}>
              {editingItem ? (
                <button id="btn-update-post" className="btn-upload-post btn-update-post" onClick={handleUpdate} disabled={uploading}>
                  {uploading ? <><span className="btn-spinner" /> Saving...</> : <>💾 Save Updates</>}
                </button>
              ) : (
                <button id="btn-upload-post" className="btn-upload-post" onClick={handleUpload} disabled={uploading}>
                  {uploading ? <><span className="btn-spinner" /> Publishing...</> : <>📤 Publish Content</>}
                </button>
              )}
              <button className="btn-clear-editor" onClick={() => { clearForm(); setUploadMsg(null); setEditingItem(null); }}>🗑️ Clear Form</button>
            </div>

            {/* Hidden files */}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} id="image-file-input" onChange={handleImageUpload} />
            <input ref={gifInputRef} type="file" accept="image/gif" style={{ display: "none" }} id="gif-file-input" onChange={handleGifUpload} />
          </div>
        )}

        {/* ── PUBLISHED LIST PANEL ── */}
        {activeView === "posts" && (
          <div className="posts-panel">
            <div className="editor-section-header">
              <div className="editor-section-icon">📂</div>
              <div>
                <h2 className="editor-section-title">
                  Published {CONTENT_TYPES.find(c => c.id === contentType)?.label}
                </h2>
                <p className="editor-section-sub">Browse, edit, or delete items in this collection.</p>
              </div>
            </div>

            {loadingItems ? (
              <div className="posts-loading"><div className="posts-spinner" /><p>Loading list...</p></div>
            ) : items.length === 0 ? (
              <div className="posts-empty">
                <div className="posts-empty-icon">📭</div>
                <h3>No items found</h3>
                <p>Add some items in the editor tab to populate this list.</p>
                <button className="btn-go-editor" onClick={() => setActiveView("editor")}>➕ Add First Item</button>
              </div>
            ) : (
              <div className="az-directory">
                {/* 1. VIEW BLOG POSTS OR DISEASES A-Z LIST */}
                {(contentType === "posts" || contentType === "diseases") && (
                  <>
                    <div className="az-nav">
                      {sortedGroupKeys.map((l) => (<a key={l} href={`#az-section-${l}`} className="az-nav-chip">{l}</a>))}
                    </div>
                    {sortedGroupKeys.map((letter) => (
                      <section key={letter} id={`az-section-${letter}`} className="az-section">
                        <div className="az-section-header">
                          <div className="az-letter-badge">{letter}</div>
                          <span className="az-count">{grouped[letter].length} item{grouped[letter].length !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="az-posts-list">
                          {grouped[letter].map((item: any) => (
                            <div key={item._id} className="az-post-card">
                              <div className="az-post-header">
                                <div className="az-post-meta">
                                  <h3 className="az-post-title">{item.title || item.name}</h3>
                                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                                    {item.categories && item.categories.map((c: string) => (
                                      <span key={c} className="category-tag">{c}</span>
                                    ))}
                                    {item.updatedAt && (
                                      <span className="az-post-date">Modified: {new Date(item.updatedAt).toLocaleDateString("en-IN")}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="az-post-actions">
                                  <button className="btn-expand-post" onClick={() => setExpandedItem(expandedItem === item._id ? null : item._id)}>
                                    {expandedItem === item._id ? "▲ Collapse" : "▼ Preview"}
                                  </button>
                                  <button className="btn-edit-post" onClick={() => handleEditInit(item)}>✏️ Edit</button>
                                  <button className="btn-delete-post" onClick={() => handleDelete(item._id)} disabled={deletingId === item._id}>
                                    {deletingId === item._id ? "..." : "🗑️"}
                                  </button>
                                </div>
                              </div>
                              {expandedItem === item._id && (
                                <div className="az-post-content doc-content">
                                  {contentType === "posts" ? (
                                    <div dangerouslySetInnerHTML={{ __html: item.content }} />
                                  ) : (
                                    <div className="disease-preview-layout">
                                      <p><strong>📖 Overview:</strong> {item.overview}</p>
                                      {item.symptoms && item.symptoms.length > 0 && (
                                        <p><strong>🤒 Symptoms:</strong> {item.symptoms.join(" • ")}</p>
                                      )}
                                      {item.treatmentOptions && item.treatmentOptions.length > 0 && (
                                        <p><strong>💊 Treatments:</strong> {item.treatmentOptions.join(" • ")}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </>
                )}

                {/* 2. VIEW HEALTH LIBRARY CATEGORIES LIST */}
                {contentType === "library" && (
                  <div className="library-list-wrapper">
                    {["symptoms", "tests", "treatments"].map((categoryKey) => {
                      const catItems = (grouped[categoryKey] || []) as LibraryItem[];
                      if (catItems.length === 0) return null;
                      return (
                        <div key={categoryKey} style={{ marginBottom: "2rem" }}>
                          <h3 className="section-category-title">{getLibraryTypeLabel(categoryKey)}</h3>
                          <div className="az-posts-list" style={{ marginTop: "1rem" }}>
                            {catItems.map((item) => (
                              <div key={item._id} className="az-post-card">
                                <div className="az-post-header">
                                  <div className="az-post-meta">
                                    <h4 className="az-post-title" style={{ fontSize: "1.1rem" }}>{item.title}</h4>
                                    <p className="text-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>{item.description}</p>
                                  </div>
                                  <div className="az-post-actions">
                                    <button className="btn-expand-post" onClick={() => setExpandedItem(expandedItem === item._id ? null : item._id)}>
                                      {expandedItem === item._id ? "▲ Collapse" : "▼ Preview"}
                                    </button>
                                    <button className="btn-edit-post" onClick={() => handleEditInit(item)}>✏️ Edit</button>
                                    <button className="btn-delete-post" onClick={() => handleDelete(item._id)} disabled={deletingId === item._id}>
                                      {deletingId === item._id ? "..." : "🗑️"}
                                    </button>
                                  </div>
                                </div>
                                {expandedItem === item._id && (
                                  <div className="az-post-content doc-content" dangerouslySetInnerHTML={{ __html: item.content }} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. VIEW HEALTH TIPS LIST */}
                {contentType === "tips" && (
                  <div className="library-list-wrapper">
                    {["nutrition", "fitness", "mental", "sleep", "prevention", "hydration"].map((catKey) => {
                      const catItems = (grouped[catKey] || []) as Tip[];
                      if (catItems.length === 0) return null;
                      return (
                        <div key={catKey} style={{ marginBottom: "2rem" }}>
                          <h3 className="section-category-title">{getTipCategoryLabel(catKey)}</h3>
                          <div className="az-posts-list" style={{ marginTop: "1rem" }}>
                            {catItems.map((item) => (
                              <div key={item._id} className="az-post-card" style={{ borderLeft: `4px solid ${item.tagColor}` }}>
                                <div className="az-post-header">
                                  <div className="az-post-meta">
                                    <h4 className="az-post-title" style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <span>{item.icon}</span> {item.title}
                                    </h4>
                                    <span className="category-tag" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${item.tagColor}`, color: item.tagColor, marginTop: "0.25rem", display: "inline-block", width: "max-content" }}>{item.tag}</span>
                                  </div>
                                  <div className="az-post-actions">
                                    <button className="btn-expand-post" onClick={() => setExpandedItem(expandedItem === item._id ? null : item._id)}>
                                      {expandedItem === item._id ? "▲ Collapse" : "▼ Preview"}
                                    </button>
                                    <button className="btn-edit-post" onClick={() => handleEditInit(item)}>✏️ Edit</button>
                                    <button className="btn-delete-post" onClick={() => handleDelete(item._id)} disabled={deletingId === item._id}>
                                      {deletingId === item._id ? "..." : "🗑️"}
                                    </button>
                                  </div>
                                </div>
                                {expandedItem === item._id && (
                                  <div className="az-post-content doc-content" style={{ padding: "1rem 1.25rem" }}>
                                    <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-main)" }}>{item.body}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 4. VIEW GENERAL FAQs LIST */}
                {contentType === "faq" && (
                  <div className="az-posts-list">
                    {items.map((item: Faq) => (
                      <div key={item._id} className="az-post-card">
                        <div className="az-post-header">
                          <div className="az-post-meta">
                            <h4 className="az-post-title" style={{ fontSize: "1.05rem" }}>❓ {item.q}</h4>
                          </div>
                          <div className="az-post-actions">
                            <button className="btn-expand-post" onClick={() => setExpandedItem(expandedItem === item._id ? null : item._id)}>
                              {expandedItem === item._id ? "▲ Collapse" : "▼ Answer"}
                            </button>
                            <button className="btn-edit-post" onClick={() => handleEditInit(item)}>✏️ Edit</button>
                            <button className="btn-delete-post" onClick={() => handleDelete(item._id)} disabled={deletingId === item._id}>
                              {deletingId === item._id ? "..." : "🗑️"}
                            </button>
                          </div>
                        </div>
                        {expandedItem === item._id && (
                          <div className="az-post-content doc-content" style={{ padding: "1rem 1.25rem" }}>
                            <p style={{ margin: 0, fontSize: "0.95rem" }}>{item.a}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Link modal ── */}
      {showLinkModal && (
        <div className="modal-overlay" id="link-modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">🔗 Insert Hyperlink</h3>
            <input autoFocus type="url" className="modal-input" id="link-url-input" placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmLink(); }} />
            <div className="modal-actions">
              <button className="btn-modal-confirm" id="btn-confirm-link" onClick={confirmLink}>✅ Insert Link</button>
              <button className="btn-modal-cancel" id="btn-cancel-link" onClick={() => setShowLinkModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ─── Content Navigator Tabs ───────────────────────────── */
        .content-type-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; border-bottom: 2px solid rgba(255,255,255,0.05); padding-bottom: 1rem; margin-bottom: 1rem; }
        .type-tab-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: #070c15; color: #9ca3af; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .type-tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .type-tab-btn.active { background: rgba(0,200,150,0.1); border-color: rgba(0,200,150,0.3); color: #00c896; box-shadow: 0 4px 12px rgba(0,200,150,0.1); }
        .type-icon { font-size: 1.1rem; }

        /* ─── Grid layouts for forms ───────────────────────────── */
        .grid-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }
        .full-width { grid-column: span 2; }
        .form-textarea { width: 100%; min-height: 120px; padding: 0.75rem 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #f3f4f6; font-size: 0.95rem; font-family: inherit; outline: none; transition: border-color 0.2s; box-sizing: border-box; resize: vertical; }
        .form-textarea:focus { border-color: #00c896; }
        .large-textarea { min-height: 180px; }

        /* Categories Checklist Pill buttons */
        .categories-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); }
        .cat-pill-btn { padding: 0.4rem 0.85rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); color: #9ca3af; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .cat-pill-btn:hover { background: rgba(255,255,255,0.06); color: #fff; }
        .cat-pill-btn.active { background: rgba(0,200,150,0.15); border-color: #00c896; color: #00c896; }

        /* Disease FAQ row items builder */
        .faq-builder-section { background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.06); padding: 1.25rem; border-radius: 12px; }
        .btn-add-faq { padding: 0.4rem 1rem; background: rgba(0,200,150,0.15); color: #00c896; border: 1px solid rgba(0,200,150,0.3); border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .btn-add-faq:hover { background: #00c896; color: #030712; }
        .faq-builder-row { display: flex; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.75rem; align-items: flex-start; }
        .faq-row-input { width: 100%; padding: 0.6rem 0.85rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.9rem; font-weight: 600; outline: none; }
        .faq-row-input:focus { border-color: #00c896; }
        .faq-row-textarea { width: 100%; min-height: 70px; padding: 0.6rem 0.85rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.9rem; font-family: inherit; outline: none; resize: vertical; }
        .faq-row-textarea:focus { border-color: #00c896; }
        .btn-remove-faq { padding: 0.5rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; color: #f87171; cursor: pointer; transition: all 0.2s; }
        .btn-remove-faq:hover { background: #ef4444; color: #fff; }

        /* Categorized Subheaders in published list */
        .section-category-title { font-size: 1.15rem; font-weight: 800; border-bottom: 2px solid rgba(255,255,255,0.08); padding-bottom: 0.5rem; color: #00c896; text-transform: uppercase; letter-spacing: 0.05em; }
        .category-tag { font-size: 0.7rem; font-weight: 700; color: #00c896; background: rgba(0,200,150,0.1); padding: 0.15rem 0.5rem; border-radius: 4px; text-transform: uppercase; }

        /* Disease preview panel */
        .disease-preview-layout { display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.95rem; line-height: 1.6; }
        .disease-preview-layout p { margin: 0; }

        /* ─── Root & layout ────────────────────────────────────── */
        .post-editor-root { display: flex; flex-direction: column; gap: 1.5rem; width: 100%; }

        /* ─── View toggle ──────────────────────────────────────── */
        .editor-view-toggle { display: flex; gap: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 1rem; }
        .toggle-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.4rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #9ca3af; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .toggle-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .toggle-btn.active { background: rgba(0,200,150,0.12); border-color: rgba(0,200,150,0.4); color: #00c896; }
        .post-count-badge { background: #00c896; color: #030712; font-size: 0.7rem; font-weight: 800; padding: 0.1rem 0.45rem; border-radius: 999px; min-width: 18px; text-align: center; margin-left: 0.25rem; }

        /* ─── Section header ───────────────────────────────────── */
        .editor-section-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; }
        .editor-section-icon { font-size: 2rem; flex-shrink: 0; line-height: 1; margin-top: 0.15rem; }
        .editor-section-title { font-size: 1.3rem; font-weight: 700; color: #ffffff; margin: 0 0 0.25rem; }
        .editor-section-sub { color: #9ca3af; font-size: 0.9rem; margin: 0; }
        .editor-section-sub kbd { display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 0 5px; font-size: 0.8rem; color: #00c896; font-family: monospace; }

        /* ─── Title field ──────────────────────────────────────── */
        .title-field-wrapper { margin-bottom: 1.25rem; }
        .field-label { display: block; font-size: 0.85rem; font-weight: 700; color: #9ca3af; letter-spacing: 0.04em; margin-bottom: 0.5rem; text-transform: uppercase; }
        .post-title-input { width: 100%; padding: 0.85rem 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #f3f4f6; font-size: 1.1rem; font-weight: 600; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
        .post-title-input::placeholder { color: #4b5563; }
        .post-title-input:focus { border-color: #00c896; }
        .title-category-preview { margin-top: 0.5rem; font-size: 0.85rem; color: #9ca3af; display: flex; align-items: center; gap: 0.5rem; }
        .category-chip { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: linear-gradient(135deg, #00c896, #10b981); color: #030712; font-weight: 900; font-size: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,200,150,0.3); }

        /* ─── Toolbar ──────────────────────────────────────────── */
        .editor-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; padding: 0.6rem 0.75rem; background: #0d1424; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px 10px 0 0; border-bottom: none; }
        .toolbar-group { display: flex; align-items: center; gap: 0.2rem; }
        .toolbar-sep { width: 1px; height: 22px; background: rgba(255,255,255,0.1); margin: 0 0.3rem; flex-shrink: 0; }
        .tb-btn { padding: 0.3rem 0.55rem; background: transparent; border: 1px solid transparent; border-radius: 6px; color: #d1d5db; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; font-family: inherit; }
        .tb-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12); color: #ffffff; }
        .tb-btn:active { transform: scale(0.95); }
        .tb-select { padding: 0.28rem 0.45rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #d1d5db; font-size: 0.82rem; cursor: pointer; outline: none; width: 68px; }
        .tb-select-wide { width: 110px; }
        .tb-select:focus { border-color: #00c896; }
        .tb-color-label { display: flex; align-items: center; gap: 0.25rem; padding: 0.28rem 0.55rem; background: transparent; border: 1px solid transparent; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
        .tb-color-label:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12); }
        .tb-color-icon { font-size: 0.85rem; font-weight: 900; color: #f3f4f6; }
        .tb-hl-icon { color: #fde68a; }
        .tb-color-input { width: 22px; height: 22px; border: none; border-radius: 4px; cursor: pointer; padding: 0; background: transparent; }

        /* ─── Table size picker in toolbar ─────────────────────── */
        .tb-table-wrap { position: relative; display: inline-flex; }
        .tb-table-picker-popup { display: none; position: absolute; top: calc(100% + 8px); left: 0; z-index: 200; background: #0b111f; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 0.75rem; box-shadow: 0 12px 40px rgba(0,0,0,0.6); min-width: 200px; }
        .tb-table-wrap:hover .tb-table-picker-popup { display: block; }
        .tb-picker-label { font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.5rem; font-weight: 600; }
        .tb-size-grid { display: grid; grid-template-columns: repeat(8, 20px); gap: 3px; }
        .tb-size-cell { width: 20px; height: 20px; border: 1px solid rgba(255,255,255,0.12); border-radius: 3px; cursor: pointer; transition: all 0.1s; background: rgba(255,255,255,0.03); }
        .tb-size-cell.active { background: rgba(0,200,150,0.35); border-color: #00c896; }
        .tb-picker-size-label { margin-top: 0.5rem; font-size: 0.8rem; color: #00c896; font-weight: 700; text-align: center; }

        /* ─── Editor body ──────────────────────────────────────── */
        .post-content-editor { min-height: 450px; max-height: 700px; overflow-y: auto; padding: 1.5rem; background: #070c16; border: 1px solid rgba(255,255,255,0.08); border-radius: 0 0 10px 10px; color: #e5e7eb; font-size: 1rem; line-height: 1.8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; outline: none; position: relative; word-break: break-word; }
        .post-content-editor:empty::before { content: attr(data-placeholder); color: #374151; font-size: 0.95rem; line-height: 1.8; white-space: pre-line; pointer-events: none; }
        .post-content-editor h1 { font-size: 2rem; font-weight: 800; color: #fff; border-bottom: 2px solid rgba(0,200,150,0.3); padding-bottom: 0.5rem; margin: 1.5rem 0 1rem; }
        .post-content-editor h2 { font-size: 1.5rem; font-weight: 700; color: #f3f4f6; margin: 1.25rem 0 0.75rem; }
        .post-content-editor h3 { font-size: 1.2rem; font-weight: 700; color: #e5e7eb; margin: 1rem 0 0.5rem; }
        .post-content-editor blockquote { border-left: 4px solid #00c896; padding: 0.5rem 1rem; margin: 1rem 0; color: #9ca3af; background: rgba(0,200,150,0.05); border-radius: 0 8px 8px 0; font-style: italic; }
        .post-content-editor table { border-collapse: collapse; width: 100%; margin: 1rem 0; table-layout: fixed; }
        .post-content-editor th, .post-content-editor td { border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; position: relative; cursor: col-resize; min-width: 40px; vertical-align: top; }
        .post-content-editor th { background: rgba(0,200,150,0.12); color: #00c896; font-weight: 700; cursor: col-resize; }
        .post-content-editor td { cursor: text; }
        .post-content-editor tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
        .post-content-editor img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; display: block; cursor: pointer; }
        .post-content-editor img:hover { outline: 2px solid rgba(0,200,150,0.5); }
        .post-content-editor a { color: #00c896; text-decoration: underline; }
        .post-content-editor code { background: rgba(0,0,0,0.4); padding: 0.15rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.88rem; color: #7ee787; }
        .post-content-editor pre { background: #0d1117; border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 1rem 0; }
        .post-content-editor ul { list-style: disc; padding-left: 1.5rem; }
        .post-content-editor ol { list-style: decimal; padding-left: 1.5rem; }
        .post-content-editor li { margin: 0.35rem 0; }
        .post-content-editor hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5rem 0; }

        /* ─── Table context toolbar ─────────────────────────────── */
        .table-ctx-toolbar { position: absolute; z-index: 100; display: flex; align-items: center; gap: 0.25rem; background: #111827; border: 1px solid rgba(0,200,150,0.3); border-radius: 8px; padding: 0.3rem 0.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.6); animation: fadeSlide 0.15s ease; flex-wrap: wrap; max-width: 420px; }
        .tbl-ctx-label { font-size: 0.72rem; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding-right: 0.25rem; }
        .tbl-ctx-sep { width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 0.2rem; }
        .tbl-ctx-btn { padding: 0.28rem 0.55rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #d1d5db; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .tbl-ctx-btn:hover { background: rgba(0,200,150,0.15); border-color: rgba(0,200,150,0.4); color: #00c896; }
        .tbl-ctx-del:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); color: #f87171; }
        .tbl-ctx-del-all { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.2); color: #f87171; }
        .tbl-ctx-del-all:hover { background: rgba(239,68,68,0.25); border-color: #ef4444; }

        /* ─── Image resize overlay ──────────────────────────────── */
        .img-resize-overlay { position: absolute; pointer-events: none; border: 2px solid #00c896; border-radius: 8px; box-shadow: 0 0 0 3px rgba(0,200,150,0.15); z-index: 50; }
        .img-resize-handle { position: absolute; bottom: -6px; right: -6px; width: 14px; height: 14px; background: #00c896; border-radius: 3px; cursor: se-resize; pointer-events: all; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
        .img-resize-toolbar { position: absolute; top: -38px; left: 0; display: flex; align-items: center; gap: 0.3rem; background: #111827; border: 1px solid rgba(0,200,150,0.3); border-radius: 7px; padding: 0.25rem 0.5rem; pointer-events: all; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
        .img-size-label { font-size: 0.72rem; color: #9ca3af; font-weight: 600; min-width: 40px; }
        .img-sz-btn { padding: 0.2rem 0.45rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #d1d5db; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .img-sz-btn:hover { background: rgba(0,200,150,0.15); border-color: #00c896; color: #00c896; }
        .img-sz-del { color: #f87171; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.06); }
        .img-sz-del:hover { background: rgba(239,68,68,0.2); border-color: #ef4444; }

        /* ─── Slash command menu ────────────────────────────────── */
        .slash-menu { position: absolute; z-index: 300; width: 280px; background: #0b111f; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; box-shadow: 0 16px 50px rgba(0,0,0,0.7); overflow: hidden; animation: fadeSlide 0.15s ease; }
        .slash-menu-header { padding: 0.5rem 0.85rem; font-size: 0.72rem; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .slash-menu-header kbd { display: inline-block; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 0 5px; font-size: 0.75rem; color: #00c896; margin-left: 4px; }
        .slash-empty { padding: 1rem; font-size: 0.85rem; color: #6b7280; text-align: center; }
        .slash-item { display: flex; align-items: center; gap: 0.65rem; width: 100%; padding: 0.55rem 0.85rem; background: transparent; border: none; cursor: pointer; transition: background 0.12s; text-align: left; }
        .slash-item.active, .slash-item:hover { background: rgba(0,200,150,0.1); }
        .slash-icon { font-size: 1rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.06); border-radius: 6px; flex-shrink: 0; font-weight: 700; color: #d1d5db; }
        .slash-text { display: flex; flex-direction: column; gap: 1px; }
        .slash-label { font-size: 0.88rem; font-weight: 600; color: #ffffff; }
        .slash-desc { font-size: 0.75rem; color: #6b7280; }

        /* ─── Slash table picker ────────────────────────────────── */
        .slash-table-picker { padding: 0.75rem; }
        .slash-picker-label { font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.6rem; font-weight: 600; }
        .slash-back-btn { margin-top: 0.6rem; padding: 0.3rem 0.75rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #9ca3af; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
        .slash-back-btn:hover { color: #fff; }

        /* ─── Stats bar ─────────────────────────────────────────── */
        .editor-stats-bar { margin-top: 0.5rem; font-size: 0.78rem; color: #4b5563; padding: 0 0.25rem; }
        .editor-stats-bar kbd { display: inline-block; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 0 4px; font-size: 0.75rem; color: #9ca3af; }

        /* ─── Feedback ──────────────────────────────────────────── */
        .upload-feedback { padding: 0.85rem 1.25rem; border-radius: 10px; font-size: 0.9rem; font-weight: 600; animation: fadeSlide 0.3s ease; }
        .upload-feedback.success { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); color: #34d399; }
        .upload-feedback.error   { background: rgba(239,68,68,0.12);   border: 1px solid rgba(239,68,68,0.3);   color: #f87171; }

        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

        /* ─── Actions row ───────────────────────────────────────── */
        .editor-actions { display: flex; gap: 1rem; align-items: center; }
        .btn-upload-post { display: flex; align-items: center; gap: 0.6rem; padding: 0.85rem 2rem; background: linear-gradient(135deg, #00c896, #10b981); color: #030712; border: none; border-radius: 10px; font-size: 1rem; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(0,200,150,0.3); }
        .btn-upload-post:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,200,150,0.45); }
        .btn-upload-post:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(3,7,18,0.3); border-top-color: #030712; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .btn-clear-editor { padding: 0.85rem 1.5rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #9ca3af; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-clear-editor:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #f87171; }

        /* ─── Published list panel ───────────────────────────────── */
        .posts-loading { display: flex; flex-direction: column; align-items: center; padding: 3rem; color: #9ca3af; gap: 1rem; }
        .posts-spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.08); border-top-color: #00c896; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .posts-empty { text-align: center; padding: 3rem; color: #9ca3af; }
        .posts-empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        .posts-empty h3 { color: #ffffff; font-size: 1.25rem; margin-bottom: 0.5rem; }
        .posts-empty p { margin-bottom: 1.5rem; }
        .btn-go-editor { padding: 0.7rem 1.5rem; background: linear-gradient(135deg, #00c896, #10b981); color: #030712; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-go-editor:hover { transform: translateY(-2px); }

        /* ─── A-Z Directory ─────────────────────────────────────── */
        .az-directory { display: flex; flex-direction: column; gap: 0; }
        .az-nav { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; margin-bottom: 1.5rem; }
        .az-nav-chip { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: rgba(0,200,150,0.1); border: 1px solid rgba(0,200,150,0.2); border-radius: 8px; color: #00c896; font-weight: 700; font-size: 0.9rem; text-decoration: none; transition: all 0.2s; }
        .az-nav-chip:hover { background: rgba(0,200,150,0.25); transform: translateY(-2px); }
        .az-section { margin-bottom: 1.75rem; scroll-margin-top: 80px; }
        .az-section-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem; }
        .az-letter-badge { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #00c896, #10b981); color: #030712; font-size: 1.6rem; font-weight: 900; border-radius: 12px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,200,150,0.3); }
        .az-count { color: #9ca3af; font-size: 0.85rem; font-weight: 600; }
        .az-posts-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .az-post-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; transition: border-color 0.2s; }
        .az-post-card:hover { border-color: rgba(0,200,150,0.2); }
        .az-post-header { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.25rem; gap: 1rem; }
        .az-post-meta { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0; }
        .az-post-title { font-size: 1rem; font-weight: 700; color: #ffffff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .az-post-date { font-size: 0.75rem; color: #9ca3af; }
        .az-post-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
        .btn-expand-post { padding: 0.4rem 0.9rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #9ca3af; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-expand-post:hover { background: rgba(0,200,150,0.1); border-color: rgba(0,200,150,0.3); color: #00c896; }
        .btn-delete-post { padding: 0.4rem 0.6rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; color: #f87171; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
        .btn-delete-post:hover { background: rgba(239,68,68,0.2); border-color: #ef4444; }
        .btn-delete-post:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-edit-post { padding: 0.4rem 0.9rem; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; color: #93c5fd; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-edit-post:hover { background: rgba(59,130,246,0.2); border-color: #3b82f6; color: #bfdbfe; }

        /* ─── Edit mode banner ──────────────────────────────────── */
        .edit-mode-banner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 1.25rem; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.25); border-radius: 10px; color: #93c5fd; font-size: 0.9rem; margin-bottom: 1.25rem; animation: fadeSlide 0.25s ease; }
        .btn-cancel-edit { padding: 0.35rem 0.85rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; color: #f87171; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0; }
        .btn-cancel-edit:hover { background: rgba(239,68,68,0.2); border-color: #ef4444; }
        .btn-update-post { background: linear-gradient(135deg, #3b82f6, #6366f1) !important; box-shadow: 0 4px 14px rgba(59,130,246,0.35) !important; }
        .btn-update-post:hover { box-shadow: 0 6px 20px rgba(59,130,246,0.5) !important; }

        /* ─── Post content (doc-style) ──────────────────────────── */
        .az-post-content { padding: 1.25rem 1.5rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); animation: fadeIn 0.25s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .doc-content { color: #d1d5db; font-size: 0.97rem; line-height: 1.8; }
        .doc-content h1 { font-size: 1.9rem; font-weight: 800; color: #fff; border-bottom: 2px solid rgba(0,200,150,0.3); padding-bottom: 0.5rem; margin: 1.5rem 0 1rem; }
        .doc-content h2 { font-size: 1.4rem; font-weight: 700; color: #f3f4f6; margin: 1.25rem 0 0.75rem; }
        .doc-content h3 { font-size: 1.15rem; font-weight: 700; color: #e5e7eb; margin: 1rem 0 0.5rem; }
        .doc-content blockquote { border-left: 4px solid #00c896; padding: 0.5rem 1rem; margin: 1rem 0; color: #9ca3af; background: rgba(0,200,150,0.05); border-radius: 0 8px 8px 0; font-style: italic; }
        .doc-content table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
        .doc-content th, .doc-content td { border: 1px solid rgba(255,255,255,0.15); padding: 8px 12px; }
        .doc-content th { background: rgba(0,200,150,0.12); color: #00c896; font-weight: 700; }
        .doc-content tr:nth-child(even) td { background: rgba(255,255,255,0.01); }
        .doc-content img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; display: block; }
        .doc-content a { color: #00c896; text-decoration: underline; }
        .doc-content code { background: rgba(0,0,0,0.4); padding: 0.15rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.88rem; color: #7ee787; }
        .doc-content pre { background: #0d1117; border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 1rem 0; border: 1px solid rgba(255,255,255,0.08); }
        .doc-content ul { list-style: disc; padding-left: 1.5rem; }
        .doc-content ol { list-style: decimal; padding-left: 1.5rem; }
        .doc-content li { margin: 0.35rem 0; }
        .doc-content hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5rem 0; }

        /* ─── Modal ─────────────────────────────────────────────── */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); animation: fadeIn 0.15s ease; }
        .modal-box { background: #0b0f19; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 1.75rem; width: 420px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .modal-title { font-size: 1.1rem; font-weight: 700; color: #ffffff; margin: 0 0 1rem; }
        .modal-input { width: 100%; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f3f4f6; font-size: 0.95rem; outline: none; margin-bottom: 1rem; box-sizing: border-box; transition: border-color 0.2s; }
        .modal-input:focus { border-color: #00c896; }
        .modal-actions { display: flex; gap: 0.75rem; }
        .btn-modal-confirm { flex: 1; padding: 0.7rem; background: linear-gradient(135deg, #00c896, #10b981); color: #030712; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .btn-modal-confirm:hover { transform: translateY(-1px); }
        .btn-modal-cancel { padding: 0.7rem 1.25rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #9ca3af; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-modal-cancel:hover { background: rgba(255,255,255,0.1); color: #fff; }
      `}</style>
    </>
  );
}
