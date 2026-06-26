"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Post {
  _id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

interface GroupedPosts {
  [letter: string]: Post[];
}

// ─── Toolbar button definition ─────────────────────────────────────────────
interface ToolbarBtn {
  label: string;
  title: string;
  cmd?: string;
  value?: string;
  action?: () => void;
  type?: "button" | "select" | "color" | "separator";
  options?: { label: string; value: string }[];
}

export default function PostEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeView, setActiveView] = useState<"editor" | "posts">("editor");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // ── Fetch posts ────────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/admin/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ── execCommand helper ─────────────────────────────────────────────────────
  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  // ── Save / restore selection for modal dialogs ─────────────────────────────
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedSelection(sel.getRangeAt(0).cloneRange());
    }
  };

  const restoreSelection = (range: Range | null) => {
    if (!range) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  // ── Insert table ───────────────────────────────────────────────────────────
  const insertTable = () => {
    editorRef.current?.focus();
    const rows = 3;
    const cols = 3;
    let html = `<table style="border-collapse:collapse;width:100%;margin:1rem 0;">`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        const tag = r === 0 ? "th" : "td";
        html += `<${tag} style="border:1px solid rgba(255,255,255,0.2);padding:8px 12px;${
          r === 0 ? "background:rgba(0,200,150,0.12);color:#00c896;font-weight:700;" : ""
        }">${r === 0 ? `Header ${c + 1}` : `Cell`}</${tag}>`;
      }
      html += "</tr>";
    }
    html += "</table><p><br></p>";
    exec("insertHTML", html);
  };

  // ── Insert horizontal rule ─────────────────────────────────────────────────
  const insertHR = () => {
    exec("insertHTML", `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:1.5rem 0;"/><p><br></p>`);
  };

  // ── Insert code block ─────────────────────────────────────────────────────
  const insertCodeBlock = () => {
    exec(
      "insertHTML",
      `<pre style="background:#0d1117;color:#7ee787;padding:1rem 1.25rem;border-radius:8px;font-family:monospace;font-size:0.9rem;overflow-x:auto;border:1px solid rgba(255,255,255,0.08);margin:1rem 0;white-space:pre-wrap;"><code>// Your code here</code></pre><p><br></p>`
    );
  };

  // ── Insert callout box ─────────────────────────────────────────────────────
  const insertCallout = (type: "info" | "warning" | "tip" | "note") => {
    const styles: Record<string, { bg: string; border: string; color: string; icon: string }> = {
      info:    { bg: "rgba(59,130,246,0.1)",   border: "#3b82f6", color: "#93c5fd", icon: "ℹ️" },
      warning: { bg: "rgba(234,179,8,0.1)",    border: "#eab308", color: "#fde68a", icon: "⚠️" },
      tip:     { bg: "rgba(0,200,150,0.1)",    border: "#00c896", color: "#6ee7b7", icon: "💡" },
      note:    { bg: "rgba(168,85,247,0.1)",   border: "#a855f7", color: "#d8b4fe", icon: "📝" },
    };
    const s = styles[type];
    exec(
      "insertHTML",
      `<div style="background:${s.bg};border-left:4px solid ${s.border};border-radius:0 8px 8px 0;padding:1rem 1.25rem;margin:1rem 0;color:${s.color};"><strong>${s.icon} ${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> Edit this callout text.</div><p><br></p>`
    );
  };

  // ── Insert link ────────────────────────────────────────────────────────────
  const handleInsertLink = () => {
    saveSelection();
    setLinkUrl("");
    setShowLinkModal(true);
  };

  const confirmLink = () => {
    restoreSelection(savedSelection);
    editorRef.current?.focus();
    const url = linkUrl.trim();
    if (url) {
      const sel = window.getSelection();
      const selectedText = sel && sel.toString() ? sel.toString() : url;
      exec(
        "insertHTML",
        `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#00c896;text-decoration:underline;">${selectedText}</a>`
      );
    }
    setShowLinkModal(false);
  };

  // ── Insert image from file ─────────────────────────────────────────────────
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      editorRef.current?.focus();
      exec(
        "insertHTML",
        `<img src="${src}" alt="Uploaded image" style="max-width:100%;border-radius:8px;margin:0.5rem 0;display:block;"/><p><br></p>`
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Insert GIF from file ───────────────────────────────────────────────────
  const handleGifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      editorRef.current?.focus();
      exec(
        "insertHTML",
        `<img src="${src}" alt="Animated GIF" style="max-width:100%;border-radius:8px;margin:0.5rem 0;display:block;"/><p><br></p>`
      );
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Insert flow diagram (basic Mermaid placeholder) ────────────────────────
  const insertFlowDiagram = () => {
    exec(
      "insertHTML",
      `<div style="background:#0d1117;border:1px solid rgba(0,200,150,0.3);border-radius:8px;padding:1rem;margin:1rem 0;font-family:monospace;color:#7ee787;font-size:0.85rem;white-space:pre;">
📊 Flow Diagram — Replace with your diagram code:

graph TD
    A[Start] --&gt; B{Decision}
    B --&gt;|Yes| C[Action 1]
    B --&gt;|No| D[Action 2]
    C --&gt; E[End]
    D --&gt; E[End]</div><p><br></p>`
    );
  };

  // ── Upload post ────────────────────────────────────────────────────────────
  const handleUploadPost = async () => {
    const content = editorRef.current?.innerHTML || "";
    if (!title.trim()) {
      setUploadMsg({ type: "error", text: "Please enter a post title." });
      return;
    }
    if (!content.trim() || content === "<br>" || content === "<p><br></p>") {
      setUploadMsg({ type: "error", text: "Please add some content to the post." });
      return;
    }

    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({
          type: "success",
          text: `✅ Post uploaded! Categorized under section "${data.category}".`,
        });
        setTitle("");
        if (editorRef.current) editorRef.current.innerHTML = "";
        fetchPosts();
      } else {
        setUploadMsg({ type: "error", text: data.error || "Upload failed." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  // ── Update post (edit mode) ────────────────────────────────────────────────
  const handleUpdatePost = async () => {
    if (!editingPost) return;
    const content = editorRef.current?.innerHTML || "";
    if (!title.trim()) {
      setUploadMsg({ type: "error", text: "Please enter a post title." });
      return;
    }
    if (!content.trim() || content === "<br>" || content === "<p><br></p>") {
      setUploadMsg({ type: "error", text: "Please add some content to the post." });
      return;
    }

    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await fetch(`/api/admin/posts?id=${editingPost._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg({
          type: "success",
          text: `✅ Post updated! Now categorized under section "${data.category}".`,
        });
        setEditingPost(null);
        setTitle("");
        if (editorRef.current) editorRef.current.innerHTML = "";
        fetchPosts();
      } else {
        setUploadMsg({ type: "error", text: data.error || "Update failed." });
      }
    } catch {
      setUploadMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  // ── Load post into editor for editing ──────────────────────────────────────
  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setTitle(post.title);
    // Switch to editor view first, then set content after mount
    setActiveView("editor");
    setUploadMsg(null);
    // Use a short timeout to let the editor mount before setting innerHTML
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = post.content;
        editorRef.current.focus();
      }
    }, 50);
  };

  // ── Delete post ────────────────────────────────────────────────────────────
  const handleDeletePost = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/posts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p._id !== id));
      } else {
        alert("Failed to delete post.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ── Group posts A-Z ────────────────────────────────────────────────────────
  const groupedPosts: GroupedPosts = posts.reduce((acc, post) => {
    const key = post.category || "#";
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {} as GroupedPosts);

  const sortedLetters = Object.keys(groupedPosts).sort((a, b) => a.localeCompare(b));

  // ─── Toolbar definition ────────────────────────────────────────────────────
  return (
    <>
      <div className="post-editor-root">
        {/* View toggle */}
        <div className="editor-view-toggle">
          <button
            className={`toggle-btn ${activeView === "editor" ? "active" : ""}`}
            onClick={() => setActiveView("editor")}
            id="btn-toggle-editor"
          >
            ✏️ Write Post
          </button>
          <button
            className={`toggle-btn ${activeView === "posts" ? "active" : ""}`}
            onClick={() => { setActiveView("posts"); fetchPosts(); }}
            id="btn-toggle-posts"
          >
            📚 Published Posts
            {posts.length > 0 && <span className="post-count-badge">{posts.length}</span>}
          </button>
        </div>

        {/* ── EDITOR PANEL ── */}
        {activeView === "editor" && (
          <div className="editor-panel">
            {/* Edit mode banner */}
            {editingPost && (
              <div className="edit-mode-banner">
                <span>✏️ Editing: <strong>{editingPost.title}</strong></span>
                <button
                  className="btn-cancel-edit"
                  onClick={() => {
                    setEditingPost(null);
                    setTitle("");
                    if (editorRef.current) editorRef.current.innerHTML = "";
                    setUploadMsg(null);
                  }}
                >
                  ✕ Cancel Edit
                </button>
              </div>
            )}
            <div className="editor-section-header">
              <div className="editor-section-icon">{editingPost ? "✏️" : "📝"}</div>
              <div>
                <h2 className="editor-section-title">{editingPost ? "Edit Post" : "Create New Post"}</h2>
                <p className="editor-section-sub">
                  {editingPost
                    ? "Make your changes below and click Update Post to save."
                    : "Write rich documentation-style content with full formatting support."}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="title-field-wrapper">
              <label htmlFor="post-title-input" className="field-label">
                📌 Post Title
              </label>
              <input
                id="post-title-input"
                type="text"
                className="post-title-input"
                placeholder="Enter post title (determines A–Z category)…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {title.trim() && (
                <div className="title-category-preview">
                  Will be categorized under:{" "}
                  <span className="category-chip">
                    {/^[A-Za-z]/.test(title.trim())
                      ? title.trim()[0].toUpperCase()
                      : "#"}
                  </span>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="editor-toolbar" id="editor-toolbar">
              {/* Text styles */}
              <div className="toolbar-group">
                <button title="Bold (Ctrl+B)" onClick={() => exec("bold")} className="tb-btn" id="tb-bold"><b>B</b></button>
                <button title="Italic (Ctrl+I)" onClick={() => exec("italic")} className="tb-btn" id="tb-italic"><i>I</i></button>
                <button title="Underline (Ctrl+U)" onClick={() => exec("underline")} className="tb-btn" id="tb-underline"><u>U</u></button>
                <button title="Strikethrough" onClick={() => exec("strikeThrough")} className="tb-btn" id="tb-strike"><s>S</s></button>
              </div>

              <div className="toolbar-sep" />

              {/* Headings */}
              <div className="toolbar-group">
                <button title="Heading 1" onClick={() => exec("formatBlock", "h1")} className="tb-btn" id="tb-h1">H1</button>
                <button title="Heading 2" onClick={() => exec("formatBlock", "h2")} className="tb-btn" id="tb-h2">H2</button>
                <button title="Heading 3" onClick={() => exec("formatBlock", "h3")} className="tb-btn" id="tb-h3">H3</button>
                <button title="Paragraph" onClick={() => exec("formatBlock", "p")} className="tb-btn" id="tb-p">¶</button>
              </div>

              <div className="toolbar-sep" />

              {/* Font size */}
              <div className="toolbar-group">
                <select
                  className="tb-select"
                  id="tb-fontsize"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) exec("fontSize", e.target.value); e.target.value = ""; }}
                  title="Font Size"
                >
                  <option value="" disabled>Size</option>
                  {["1","2","3","4","5","6","7"].map((s) => (
                    <option key={s} value={s}>{["8px","10px","12px","14px","18px","24px","36px"][+s - 1]}</option>
                  ))}
                </select>

                {/* Font family */}
                <select
                  className="tb-select tb-select-wide"
                  id="tb-fontname"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) exec("fontName", e.target.value); e.target.value = ""; }}
                  title="Font Family"
                >
                  <option value="" disabled>Font</option>
                  {["Arial","Georgia","Courier New","Times New Roman","Verdana","Trebuchet MS","Impact","Comic Sans MS"].map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="toolbar-sep" />

              {/* Colors */}
              <div className="toolbar-group">
                <label className="tb-color-label" title="Text Color">
                  <span className="tb-color-icon">A</span>
                  <input
                    type="color"
                    defaultValue="#ffffff"
                    id="tb-forecolor"
                    className="tb-color-input"
                    onChange={(e) => exec("foreColor", e.target.value)}
                    title="Text Color"
                  />
                </label>
                <label className="tb-color-label" title="Highlight Color">
                  <span className="tb-color-icon tb-hl-icon">◼</span>
                  <input
                    type="color"
                    defaultValue="#ffff00"
                    id="tb-hilite"
                    className="tb-color-input"
                    onChange={(e) => exec("hiliteColor", e.target.value)}
                    title="Highlight Color"
                  />
                </label>
              </div>

              <div className="toolbar-sep" />

              {/* Alignment */}
              <div className="toolbar-group">
                <button title="Align Left" onClick={() => exec("justifyLeft")} className="tb-btn" id="tb-align-left">⬅️</button>
                <button title="Align Center" onClick={() => exec("justifyCenter")} className="tb-btn" id="tb-align-center">↔️</button>
                <button title="Align Right" onClick={() => exec("justifyRight")} className="tb-btn" id="tb-align-right">➡️</button>
                <button title="Justify" onClick={() => exec("justifyFull")} className="tb-btn" id="tb-justify">≡</button>
              </div>

              <div className="toolbar-sep" />

              {/* Lists */}
              <div className="toolbar-group">
                <button title="Bullet List" onClick={() => exec("insertUnorderedList")} className="tb-btn" id="tb-ul">• List</button>
                <button title="Numbered List" onClick={() => exec("insertOrderedList")} className="tb-btn" id="tb-ol">1. List</button>
                <button title="Blockquote" onClick={() => exec("formatBlock", "blockquote")} className="tb-btn" id="tb-quote">❝</button>
              </div>

              <div className="toolbar-sep" />

              {/* Insert elements */}
              <div className="toolbar-group">
                <button title="Insert Table" onClick={insertTable} className="tb-btn" id="tb-table">⊞ Table</button>
                <button title="Insert Link" onClick={handleInsertLink} className="tb-btn" id="tb-link">🔗 Link</button>
                <button title="Insert Image" onClick={() => fileInputRef.current?.click()} className="tb-btn" id="tb-image">🖼️ Image</button>
                <button title="Insert Animated GIF" onClick={() => gifInputRef.current?.click()} className="tb-btn" id="tb-gif">🎞️ GIF</button>
              </div>

              <div className="toolbar-sep" />

              {/* Special blocks */}
              <div className="toolbar-group">
                <button title="Code Block" onClick={insertCodeBlock} className="tb-btn" id="tb-code">&lt;/&gt; Code</button>
                <button title="Divider Line" onClick={insertHR} className="tb-btn" id="tb-hr">— HR</button>
                <button title="Flow Diagram" onClick={insertFlowDiagram} className="tb-btn" id="tb-flow">📊 Flow</button>
              </div>

              <div className="toolbar-sep" />

              {/* Callouts */}
              <div className="toolbar-group">
                <button title="Info Callout" onClick={() => insertCallout("info")} className="tb-btn tb-callout-info" id="tb-callout-info">ℹ️</button>
                <button title="Tip Callout" onClick={() => insertCallout("tip")} className="tb-btn tb-callout-tip" id="tb-callout-tip">💡</button>
                <button title="Warning Callout" onClick={() => insertCallout("warning")} className="tb-btn tb-callout-warn" id="tb-callout-warn">⚠️</button>
                <button title="Note Callout" onClick={() => insertCallout("note")} className="tb-btn tb-callout-note" id="tb-callout-note">📝</button>
              </div>

              <div className="toolbar-sep" />

              {/* Undo / Redo */}
              <div className="toolbar-group">
                <button title="Undo (Ctrl+Z)" onClick={() => exec("undo")} className="tb-btn" id="tb-undo">↩ Undo</button>
                <button title="Redo (Ctrl+Y)" onClick={() => exec("redo")} className="tb-btn" id="tb-redo">↪ Redo</button>
                <button title="Clear Formatting" onClick={() => exec("removeFormat")} className="tb-btn" id="tb-clearfmt">✕ Clear</button>
              </div>
            </div>

            {/* Editor body */}
            <div
              ref={editorRef}
              id="post-content-editor"
              className="post-content-editor"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Start writing your documentation-style post here…&#10;&#10;Supports: headings, bold/italic, tables, images, GIFs, links, code blocks, callouts, flow diagrams, font styles, colors, and more."
              spellCheck
              onPaste={(e) => {
                // Allow rich paste
              }}
            />

            {/* Word / char count */}
            <div className="editor-stats-bar">
              <span>
                Use the toolbar above to insert tables, images, GIFs, flow diagrams, callouts, and rich formatting.
              </span>
            </div>

            {/* Upload feedback */}
            {uploadMsg && (
              <div className={`upload-feedback ${uploadMsg.type}`} id="upload-feedback">
                {uploadMsg.text}
              </div>
            )}

            {/* Upload / Update button */}
            <div className="editor-actions">
              {editingPost ? (
                <button
                  id="btn-update-post"
                  className="btn-upload-post btn-update-post"
                  onClick={handleUpdatePost}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="btn-spinner" /> Updating…
                    </>
                  ) : (
                    <>💾 Update Post</>
                  )}
                </button>
              ) : (
                <button
                  id="btn-upload-post"
                  className="btn-upload-post"
                  onClick={handleUploadPost}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="btn-spinner" /> Uploading…
                    </>
                  ) : (
                    <>📤 Upload Post</>
                  )}
                </button>
              )}
              <button
                id="btn-clear-editor"
                className="btn-clear-editor"
                onClick={() => {
                  setTitle("");
                  if (editorRef.current) editorRef.current.innerHTML = "";
                  setUploadMsg(null);
                  setEditingPost(null);
                }}
              >
                🗑️ Clear
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              id="image-file-input"
              onChange={handleImageUpload}
            />
            <input
              ref={gifInputRef}
              type="file"
              accept="image/gif"
              style={{ display: "none" }}
              id="gif-file-input"
              onChange={handleGifUpload}
            />
          </div>
        )}

        {/* ── POSTS PANEL ── */}
        {activeView === "posts" && (
          <div className="posts-panel">
            <div className="editor-section-header">
              <div className="editor-section-icon">📚</div>
              <div>
                <h2 className="editor-section-title">Published Posts — A–Z Directory</h2>
                <p className="editor-section-sub">
                  All published posts organized alphabetically by their title's first letter.
                </p>
              </div>
            </div>

            {loadingPosts ? (
              <div className="posts-loading">
                <div className="posts-spinner" />
                <p>Loading posts…</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="posts-empty">
                <div className="posts-empty-icon">📭</div>
                <h3>No posts yet</h3>
                <p>Switch to the editor and upload your first post.</p>
                <button className="btn-go-editor" onClick={() => setActiveView("editor")}>
                  ✏️ Write First Post
                </button>
              </div>
            ) : (
              <div className="az-directory">
                {/* A–Z quick nav */}
                <div className="az-nav">
                  {sortedLetters.map((l) => (
                    <a key={l} href={`#az-section-${l}`} className="az-nav-chip">{l}</a>
                  ))}
                </div>

                {sortedLetters.map((letter) => (
                  <section key={letter} id={`az-section-${letter}`} className="az-section">
                    <div className="az-section-header">
                      <div className="az-letter-badge">{letter}</div>
                      <span className="az-count">{groupedPosts[letter].length} post{groupedPosts[letter].length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="az-posts-list">
                      {groupedPosts[letter].map((post) => (
                        <div key={post._id} className="az-post-card">
                          <div className="az-post-header">
                            <div className="az-post-meta">
                              <h3 className="az-post-title">{post.title}</h3>
                              <span className="az-post-date">
                                {new Date(post.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="az-post-actions">
                              <button
                                className="btn-expand-post"
                                id={`btn-expand-${post._id}`}
                                onClick={() =>
                                  setExpandedPost(expandedPost === post._id ? null : post._id)
                                }
                                title={expandedPost === post._id ? "Collapse" : "Expand"}
                              >
                                {expandedPost === post._id ? "▲ Collapse" : "▼ Expand"}
                              </button>
                              <button
                                className="btn-edit-post"
                                id={`btn-edit-${post._id}`}
                                onClick={() => handleEditPost(post)}
                                title="Edit post"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                className="btn-delete-post"
                                id={`btn-delete-${post._id}`}
                                onClick={() => handleDeletePost(post._id)}
                                disabled={deletingId === post._id}
                                title="Delete post"
                              >
                                {deletingId === post._id ? "…" : "🗑️"}
                              </button>
                            </div>
                          </div>
                          {expandedPost === post._id && (
                            <div
                              className="az-post-content doc-content"
                              dangerouslySetInnerHTML={{ __html: post.content }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
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
            <input
              autoFocus
              type="url"
              className="modal-input"
              id="link-url-input"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmLink(); }}
            />
            <div className="modal-actions">
              <button className="btn-modal-confirm" id="btn-confirm-link" onClick={confirmLink}>✅ Insert Link</button>
              <button className="btn-modal-cancel" id="btn-cancel-link" onClick={() => setShowLinkModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ─── Root & layout ──────────────────────────────────── */
        .post-editor-root {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        /* ─── View toggle ────────────────────────────────────── */
        .editor-view-toggle {
          display: flex;
          gap: 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding-bottom: 1rem;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.4rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: #9ca3af;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }

        .toggle-btn.active {
          background: rgba(0,200,150,0.12);
          border-color: rgba(0,200,150,0.4);
          color: #00c896;
        }

        .post-count-badge {
          background: #00c896;
          color: #030712;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          min-width: 18px;
          text-align: center;
        }

        /* ─── Section header ─────────────────────────────────── */
        .editor-section-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .editor-section-icon {
          font-size: 2rem;
          flex-shrink: 0;
          line-height: 1;
          margin-top: 0.15rem;
        }

        .editor-section-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 0.25rem;
        }

        .editor-section-sub {
          color: #9ca3af;
          font-size: 0.9rem;
          margin: 0;
        }

        /* ─── Title field ────────────────────────────────────── */
        .title-field-wrapper {
          margin-bottom: 1.25rem;
        }

        .field-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: #9ca3af;
          letter-spacing: 0.04em;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }

        .post-title-input {
          width: 100%;
          padding: 0.85rem 1rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          color: #f3f4f6;
          font-size: 1.1rem;
          font-weight: 600;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .post-title-input::placeholder { color: #4b5563; }
        .post-title-input:focus { border-color: #00c896; }

        .title-category-preview {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: #9ca3af;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .category-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #00c896, #10b981);
          color: #030712;
          font-weight: 900;
          font-size: 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,200,150,0.3);
        }

        /* ─── Toolbar ────────────────────────────────────────── */
        .editor-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.25rem;
          padding: 0.6rem 0.75rem;
          background: #0d1424;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px 10px 0 0;
          border-bottom: none;
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }

        .toolbar-sep {
          width: 1px;
          height: 22px;
          background: rgba(255,255,255,0.1);
          margin: 0 0.3rem;
          flex-shrink: 0;
        }

        .tb-btn {
          padding: 0.3rem 0.55rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #d1d5db;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          font-family: inherit;
        }

        .tb-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
          color: #ffffff;
        }

        .tb-btn:active { transform: scale(0.95); }

        .tb-select {
          padding: 0.28rem 0.45rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #d1d5db;
          font-size: 0.82rem;
          cursor: pointer;
          outline: none;
          width: 68px;
        }

        .tb-select-wide { width: 110px; }

        .tb-select:focus { border-color: #00c896; }

        /* Color picker buttons */
        .tb-color-label {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.28rem 0.55rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tb-color-label:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.12);
        }

        .tb-color-icon {
          font-size: 0.85rem;
          font-weight: 900;
          color: #f3f4f6;
        }

        .tb-hl-icon { color: #fde68a; }

        .tb-color-input {
          width: 22px;
          height: 22px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
          background: transparent;
        }

        /* ─── Editor body ────────────────────────────────────── */
        .post-content-editor {
          min-height: 450px;
          max-height: 700px;
          overflow-y: auto;
          padding: 1.5rem;
          background: #070c16;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0 0 10px 10px;
          color: #e5e7eb;
          font-size: 1rem;
          line-height: 1.8;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          outline: none;
          position: relative;
          word-break: break-word;
        }

        .post-content-editor:empty::before {
          content: attr(data-placeholder);
          color: #374151;
          font-size: 0.95rem;
          line-height: 1.8;
          white-space: pre-line;
          pointer-events: none;
        }

        /* Doc-style editor formatting */
        .post-content-editor h1 {
          font-size: 2rem; font-weight: 800; color: #fff;
          border-bottom: 2px solid rgba(0,200,150,0.3);
          padding-bottom: 0.5rem; margin: 1.5rem 0 1rem;
        }
        .post-content-editor h2 {
          font-size: 1.5rem; font-weight: 700; color: #f3f4f6;
          margin: 1.25rem 0 0.75rem;
        }
        .post-content-editor h3 {
          font-size: 1.2rem; font-weight: 700; color: #e5e7eb;
          margin: 1rem 0 0.5rem;
        }
        .post-content-editor blockquote {
          border-left: 4px solid #00c896;
          padding: 0.5rem 1rem;
          margin: 1rem 0;
          color: #9ca3af;
          background: rgba(0,200,150,0.05);
          border-radius: 0 8px 8px 0;
          font-style: italic;
        }
        .post-content-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .post-content-editor th, .post-content-editor td {
          border: 1px solid rgba(255,255,255,0.15);
          padding: 8px 12px;
        }
        .post-content-editor th {
          background: rgba(0,200,150,0.12);
          color: #00c896;
          font-weight: 700;
        }
        .post-content-editor img {
          max-width: 100%;
          border-radius: 8px;
          margin: 0.5rem 0;
          display: block;
        }
        .post-content-editor a {
          color: #00c896;
          text-decoration: underline;
        }
        .post-content-editor code {
          background: rgba(0,0,0,0.4);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.88rem;
          color: #7ee787;
        }
        .post-content-editor pre {
          background: #0d1117;
          border-radius: 8px;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .post-content-editor ul { list-style: disc; padding-left: 1.5rem; }
        .post-content-editor ol { list-style: decimal; padding-left: 1.5rem; }
        .post-content-editor li { margin: 0.35rem 0; }
        .post-content-editor hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.1);
          margin: 1.5rem 0;
        }

        /* ─── Stats bar ──────────────────────────────────────── */
        .editor-stats-bar {
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: #4b5563;
          padding: 0 0.25rem;
        }

        /* ─── Feedback ───────────────────────────────────────── */
        .upload-feedback {
          padding: 0.85rem 1.25rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          animation: fadeSlide 0.3s ease;
        }

        .upload-feedback.success {
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.3);
          color: #34d399;
        }

        .upload-feedback.error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.3);
          color: #f87171;
        }

        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ─── Actions row ────────────────────────────────────── */
        .editor-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .btn-upload-post {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.85rem 2rem;
          background: linear-gradient(135deg, #00c896, #10b981);
          color: #030712;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(0,200,150,0.3);
        }

        .btn-upload-post:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,200,150,0.45);
        }

        .btn-upload-post:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(3,7,18,0.3);
          border-top-color: #030712;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-clear-editor {
          padding: 0.85rem 1.5rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: #9ca3af;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-clear-editor:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.3);
          color: #f87171;
        }

        /* ─── Posts panel ────────────────────────────────────── */
        .posts-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 3rem;
          color: #9ca3af;
          gap: 1rem;
        }

        .posts-spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(255,255,255,0.08);
          border-top-color: #00c896;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .posts-empty {
          text-align: center;
          padding: 3rem;
          color: #9ca3af;
        }

        .posts-empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        .posts-empty h3 { color: #ffffff; font-size: 1.25rem; margin-bottom: 0.5rem; }
        .posts-empty p { margin-bottom: 1.5rem; }

        .btn-go-editor {
          padding: 0.7rem 1.5rem;
          background: linear-gradient(135deg, #00c896, #10b981);
          color: #030712;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-go-editor:hover { transform: translateY(-2px); }

        /* ─── A-Z Directory ──────────────────────────────────── */
        .az-directory { display: flex; flex-direction: column; gap: 0; }

        .az-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          padding: 1rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          margin-bottom: 1.5rem;
        }

        .az-nav-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px; height: 36px;
          background: rgba(0,200,150,0.1);
          border: 1px solid rgba(0,200,150,0.2);
          border-radius: 8px;
          color: #00c896;
          font-weight: 700;
          font-size: 0.9rem;
          text-decoration: none;
          transition: all 0.2s;
        }

        .az-nav-chip:hover {
          background: rgba(0,200,150,0.25);
          transform: translateY(-2px);
        }

        .az-section {
          margin-bottom: 1.75rem;
          scroll-margin-top: 80px;
        }

        .az-section-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding-bottom: 0.75rem;
        }

        .az-letter-badge {
          width: 48px; height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #00c896, #10b981);
          color: #030712;
          font-size: 1.6rem;
          font-weight: 900;
          border-radius: 12px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0,200,150,0.3);
        }

        .az-count {
          color: #9ca3af;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .az-posts-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .az-post-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s;
        }

        .az-post-card:hover { border-color: rgba(0,200,150,0.2); }

        .az-post-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.9rem 1.25rem;
          gap: 1rem;
        }

        .az-post-meta {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
          min-width: 0;
        }

        .az-post-title {
          font-size: 1rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .az-post-date {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .az-post-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .btn-expand-post {
          padding: 0.4rem 0.9rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: #9ca3af;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .btn-expand-post:hover {
          background: rgba(0,200,150,0.1);
          border-color: rgba(0,200,150,0.3);
          color: #00c896;
        }

        .btn-delete-post {
          padding: 0.4rem 0.6rem;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 6px;
          color: #f87171;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-delete-post:hover {
          background: rgba(239,68,68,0.2);
          border-color: #ef4444;
        }

        .btn-delete-post:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-edit-post {
          padding: 0.4rem 0.9rem;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.3);
          border-radius: 6px;
          color: #93c5fd;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .btn-edit-post:hover {
          background: rgba(59,130,246,0.2);
          border-color: #3b82f6;
          color: #bfdbfe;
        }

        /* ─── Edit mode banner ───────────────────────────────── */
        .edit-mode-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 1.25rem;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 10px;
          color: #93c5fd;
          font-size: 0.9rem;
          margin-bottom: 1.25rem;
          animation: fadeSlide 0.25s ease;
        }

        .btn-cancel-edit {
          padding: 0.35rem 0.85rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 6px;
          color: #f87171;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .btn-cancel-edit:hover {
          background: rgba(239,68,68,0.2);
          border-color: #ef4444;
        }

        .btn-update-post {
          background: linear-gradient(135deg, #3b82f6, #6366f1) !important;
          box-shadow: 0 4px 14px rgba(59,130,246,0.35) !important;
        }

        .btn-update-post:hover {
          box-shadow: 0 6px 20px rgba(59,130,246,0.5) !important;
        }

        /* ─── Post content (doc-style) ───────────────────────── */
        .az-post-content {
          padding: 1.25rem 1.5rem 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          animation: fadeIn 0.25s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .doc-content {
          color: #d1d5db;
          font-size: 0.97rem;
          line-height: 1.8;
        }

        .doc-content h1 {
          font-size: 1.9rem; font-weight: 800; color: #fff;
          border-bottom: 2px solid rgba(0,200,150,0.3);
          padding-bottom: 0.5rem; margin: 1.5rem 0 1rem;
        }
        .doc-content h2 {
          font-size: 1.4rem; font-weight: 700; color: #f3f4f6;
          margin: 1.25rem 0 0.75rem;
        }
        .doc-content h3 {
          font-size: 1.15rem; font-weight: 700; color: #e5e7eb;
          margin: 1rem 0 0.5rem;
        }
        .doc-content blockquote {
          border-left: 4px solid #00c896;
          padding: 0.5rem 1rem;
          margin: 1rem 0;
          color: #9ca3af;
          background: rgba(0,200,150,0.05);
          border-radius: 0 8px 8px 0;
          font-style: italic;
        }
        .doc-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .doc-content th, .doc-content td {
          border: 1px solid rgba(255,255,255,0.15);
          padding: 8px 12px;
        }
        .doc-content th {
          background: rgba(0,200,150,0.12);
          color: #00c896;
          font-weight: 700;
        }
        .doc-content tr:nth-child(even) td { background: rgba(255,255,255,0.01); }
        .doc-content img {
          max-width: 100%;
          border-radius: 8px;
          margin: 0.5rem 0;
          display: block;
        }
        .doc-content a { color: #00c896; text-decoration: underline; }
        .doc-content code {
          background: rgba(0,0,0,0.4);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.88rem;
          color: #7ee787;
        }
        .doc-content pre {
          background: #0d1117;
          border-radius: 8px;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .doc-content ul { list-style: disc; padding-left: 1.5rem; }
        .doc-content ol { list-style: decimal; padding-left: 1.5rem; }
        .doc-content li { margin: 0.35rem 0; }
        .doc-content hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.1);
          margin: 1.5rem 0;
        }

        /* ─── Modal ──────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.15s ease;
        }

        .modal-box {
          background: #0b0f19;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 1.75rem;
          width: 420px;
          max-width: 90vw;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }

        .modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 1rem;
        }

        .modal-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #f3f4f6;
          font-size: 0.95rem;
          outline: none;
          margin-bottom: 1rem;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .modal-input:focus { border-color: #00c896; }

        .modal-actions { display: flex; gap: 0.75rem; }

        .btn-modal-confirm {
          flex: 1;
          padding: 0.7rem;
          background: linear-gradient(135deg, #00c896, #10b981);
          color: #030712;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-modal-confirm:hover { transform: translateY(-1px); }

        .btn-modal-cancel {
          padding: 0.7rem 1.25rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #9ca3af;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-modal-cancel:hover { background: rgba(255,255,255,0.1); color: #fff; }
      `}</style>
    </>
  );
}
