"use client";

import { useState, useEffect, useCallback } from "react";

interface Reply {
  replyId: string;
  authorName: string;
  content: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Comment {
  _id: string;
  authorName: string;
  content: string;
  createdAt: string;
  replies: Reply[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function CommentsManager() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback/comments", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setComments(json.comments);
      setError("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAdminReply = async (commentId: string) => {
    const content = replyText[commentId]?.trim();
    if (!content) return;
    setPosting(commentId);
    try {
      const res = await fetch("/api/feedback/admin-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reply");
      setReplyText((prev) => ({ ...prev, [commentId]: "" }));
      setExpandedId(null);
      setSuccessMsg("Admin reply posted ✓");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchComments();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setPosting(null);
    }
  };

  const handleDelete = async (commentId: string, replyId?: string) => {
    const confirmMsg = replyId
      ? "Delete this reply?"
      : "Delete this entire comment and all its replies?";
    if (!window.confirm(confirmMsg)) return;

    const key = replyId ? `reply-${replyId}` : `comment-${commentId}`;
    setDeleting(key);
    try {
      const res = await fetch("/api/feedback/admin-reply", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, replyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      setSuccessMsg("Deleted successfully ✓");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchComments();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af" }}>
        <div className="spinner" />
        <p style={{ marginTop: "1rem" }}>Loading comments…</p>
      </div>
    );
  }

  return (
    <div className="cm-root">
      <div className="cm-header">
        <div>
          <h2 className="cm-title">💬 Community Comments</h2>
          <p className="cm-subtitle">
            {comments.length} total comment{comments.length !== 1 ? "s" : ""} from users
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchComments} style={{ height: "fit-content" }}>
          🔄 Refresh
        </button>
      </div>

      {successMsg && (
        <div className="cm-success-toast">{successMsg}</div>
      )}

      {error && (
        <div style={{ color: "#f87171", padding: "1rem", background: "rgba(239,68,68,0.1)", borderRadius: 8, marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {!loading && comments.length === 0 && (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "3rem" }}>
          <div style={{ fontSize: "3rem" }}>💬</div>
          <p style={{ marginTop: "1rem" }}>No comments yet. Users can post at <code>/feedback</code>.</p>
        </div>
      )}

      <div className="cm-comments-list">
        {comments.map((comment) => (
          <div key={comment._id} className="cm-comment-card">
            {/* Comment */}
            <div className="cm-comment-top">
              <div className="cm-comment-info">
                <div className="cm-avatar">{comment.authorName.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="cm-author">{comment.authorName}</div>
                  <div className="cm-time">{timeAgo(comment.createdAt)} · {new Date(comment.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="cm-actions">
                <button
                  className="cm-btn-reply"
                  onClick={() =>
                    setExpandedId(expandedId === comment._id ? null : comment._id)
                  }
                >
                  {expandedId === comment._id ? "✕ Cancel Reply" : "🛡️ Reply as Admin"}
                </button>
                <button
                  className="cm-btn-delete"
                  disabled={deleting === `comment-${comment._id}`}
                  onClick={() => handleDelete(comment._id)}
                >
                  {deleting === `comment-${comment._id}` ? "Deleting…" : "🗑️ Delete"}
                </button>
              </div>
            </div>

            <p className="cm-comment-text">{comment.content}</p>

            {/* Admin Reply Form */}
            {expandedId === comment._id && (
              <div className="cm-reply-form">
                <div className="cm-admin-reply-label">🛡️ Posting as: HealthEdu Admin</div>
                <textarea
                  className="cm-textarea"
                  placeholder="Type your admin reply…"
                  rows={4}
                  value={replyText[comment._id] || ""}
                  onChange={(e) =>
                    setReplyText((prev) => ({ ...prev, [comment._id]: e.target.value }))
                  }
                  disabled={posting === comment._id}
                  maxLength={2000}
                />
                <div className="cm-reply-form-actions">
                  <button
                    className="cm-btn-post-reply"
                    disabled={posting === comment._id || !replyText[comment._id]?.trim()}
                    onClick={() => handleAdminReply(comment._id)}
                  >
                    {posting === comment._id ? "Posting…" : "✓ Post Admin Reply"}
                  </button>
                </div>
              </div>
            )}

            {/* Replies */}
            {comment.replies.length > 0 && (
              <div className="cm-replies">
                <div className="cm-replies-label">
                  {comment.replies.length} {comment.replies.length === 1 ? "Reply" : "Replies"}
                </div>
                {comment.replies.map((reply) => (
                  <div
                    key={reply.replyId}
                    className={`cm-reply-card ${reply.isAdmin ? "cm-reply-admin" : ""}`}
                  >
                    <div className="cm-reply-top">
                      <div className="cm-reply-info">
                        <span className="cm-reply-author">
                          {reply.isAdmin ? "🛡️ HealthEdu Admin" : reply.authorName}
                        </span>
                        {reply.isAdmin && (
                          <span className="cm-admin-pill">Admin Reply</span>
                        )}
                        <span className="cm-time">{timeAgo(reply.createdAt)}</span>
                      </div>
                      <button
                        className="cm-btn-delete"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                        disabled={deleting === `reply-${reply.replyId}`}
                        onClick={() => handleDelete(comment._id, reply.replyId)}
                      >
                        {deleting === `reply-${reply.replyId}` ? "…" : "🗑️"}
                      </button>
                    </div>
                    <p className="cm-reply-text">{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .cm-root {
          color: #f3f4f6;
        }
        .cm-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .cm-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 0.25rem;
        }
        .cm-subtitle {
          color: #9ca3af;
          font-size: 0.9rem;
        }
        .cm-success-toast {
          background: rgba(0,200,150,0.15);
          border: 1px solid rgba(0,200,150,0.3);
          color: #00c896;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin-bottom: 1.25rem;
          font-weight: 600;
        }
        .cm-comments-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .cm-comment-card {
          background: #0b0f19;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 1.5rem;
        }
        .cm-comment-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .cm-comment-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .cm-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0d9488, #0284c7);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
        }
        .cm-author {
          font-weight: 600;
          color: #fff;
          font-size: 0.95rem;
        }
        .cm-time {
          font-size: 0.8rem;
          color: #6b7280;
          margin-top: 0.1rem;
        }
        .cm-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .cm-btn-reply {
          padding: 0.45rem 0.85rem;
          background: rgba(0,200,150,0.12);
          border: 1px solid rgba(0,200,150,0.3);
          color: #00c896;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cm-btn-reply:hover {
          background: rgba(0,200,150,0.25);
        }
        .cm-btn-delete {
          padding: 0.45rem 0.85rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #f87171;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cm-btn-delete:hover {
          background: rgba(239,68,68,0.25);
        }
        .cm-btn-delete:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cm-comment-text {
          color: #d1d5db;
          line-height: 1.65;
          margin-bottom: 0.5rem;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .cm-reply-form {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(0,200,150,0.2);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }
        .cm-admin-reply-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #00c896;
          margin-bottom: 0.5rem;
        }
        .cm-textarea {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 0.75rem;
          color: #f3f4f6;
          font-size: 0.9rem;
          resize: vertical;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }
        .cm-textarea:focus {
          border-color: rgba(0,200,150,0.4);
        }
        .cm-reply-form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.75rem;
        }
        .cm-btn-post-reply {
          padding: 0.5rem 1.25rem;
          background: #00c896;
          border: none;
          border-radius: 6px;
          color: #030712;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cm-btn-post-reply:hover:not(:disabled) {
          background: #00a87e;
        }
        .cm-btn-post-reply:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .cm-replies {
          margin-top: 1rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 1rem;
        }
        .cm-replies-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
        }
        .cm-reply-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 0.85rem 1rem;
          margin-bottom: 0.5rem;
        }
        .cm-reply-admin {
          background: rgba(0,200,150,0.05);
          border-color: rgba(0,200,150,0.2);
        }
        .cm-reply-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          gap: 0.5rem;
        }
        .cm-reply-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .cm-reply-author {
          font-weight: 600;
          font-size: 0.9rem;
          color: #e5e7eb;
        }
        .cm-admin-pill {
          background: rgba(0,200,150,0.2);
          border: 1px solid rgba(0,200,150,0.4);
          color: #00c896;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          letter-spacing: 0.03em;
        }
        .cm-reply-text {
          color: #9ca3af;
          font-size: 0.9rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: #00c896;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
