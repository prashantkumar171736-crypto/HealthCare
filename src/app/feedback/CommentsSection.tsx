"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Admin Badge ──────────────────────────────────────────────────────────────

function AdminBadge() {
  return (
    <span className="cf-admin-badge" aria-label="Official Admin Reply">
      🛡️ Admin
    </span>
  );
}

// ─── Reply Item ───────────────────────────────────────────────────────────────

function ReplyItem({ reply }: { reply: Reply }) {
  return (
    <div className={`cf-reply-card ${reply.isAdmin ? "cf-reply-admin" : ""}`}>
      <div className="cf-reply-meta">
        <span className="cf-reply-author">
          {reply.isAdmin ? "HealthEdu Team" : reply.authorName}
        </span>
        {reply.isAdmin && <AdminBadge />}
        <span className="cf-reply-time">{timeAgo(reply.createdAt)}</span>
      </div>
      <p className="cf-reply-text">{reply.content}</p>
    </div>
  );
}

// ─── Reply Form ───────────────────────────────────────────────────────────────

function ReplyForm({
  commentId,
  onSuccess,
  onCancel,
}: {
  commentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !text.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback/comments/${commentId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: name.trim(), content: text.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to post reply");
      setName("");
      setText("");
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="cf-reply-form" onSubmit={handleSubmit}>
      <div className="cf-reply-form-fields">
        <input
          className="cf-input"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          disabled={loading}
          aria-label="Your name"
        />
        <textarea
          className="cf-textarea cf-textarea-sm"
          placeholder="Write your reply…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={3}
          disabled={loading}
          aria-label="Reply text"
        />
      </div>
      {error && <p className="cf-error">{error}</p>}
      <div className="cf-reply-form-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          {loading ? "Posting…" : "Post Reply"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Comment Card ─────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  onRefresh,
}: {
  comment: Comment;
  onRefresh: () => void;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const handleReplySuccess = () => {
    setShowReplyForm(false);
    onRefresh();
  };

  return (
    <div className="cf-comment-card">
      {/* Comment Header */}
      <div className="cf-comment-header">
        <div className="cf-avatar" aria-hidden="true">
          {comment.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="cf-comment-meta">
          <span className="cf-comment-author">{comment.authorName}</span>
          <span className="cf-comment-time">{timeAgo(comment.createdAt)}</span>
        </div>
      </div>

      {/* Comment Body */}
      <p className="cf-comment-text">{comment.content}</p>

      {/* Actions */}
      <div className="cf-comment-actions">
        <button
          className="cf-action-btn"
          onClick={() => setShowReplyForm((v) => !v)}
          aria-expanded={showReplyForm}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {showReplyForm ? "Cancel" : "Reply"}
        </button>
        {comment.replies.length > 0 && (
          <button
            className="cf-action-btn cf-action-btn-muted"
            onClick={() => setShowReplies((v) => !v)}
          >
            {showReplies ? "▲" : "▼"} {comment.replies.length}{" "}
            {comment.replies.length === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {/* Inline Reply Form */}
      {showReplyForm && (
        <ReplyForm
          commentId={comment._id}
          onSuccess={handleReplySuccess}
          onCancel={() => setShowReplyForm(false)}
        />
      )}

      {/* Replies List */}
      {showReplies && comment.replies.length > 0 && (
        <div className="cf-replies-list">
          {comment.replies.map((reply) => (
            <ReplyItem key={reply.replyId} reply={reply} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Comment Form ─────────────────────────────────────────────────────────

function NewCommentForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (!name.trim() || !text.trim()) {
      setError("Please provide your name and write a comment.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/feedback/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: name.trim(), content: text.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to post comment");
      setName("");
      setText("");
      setSuccess(true);
      onSuccess();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="post-comment" className="cf-new-comment-card">
      <h2 className="cf-new-comment-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Post a Comment
      </h2>
      <form className="cf-form" onSubmit={handleSubmit}>
        <div className="cf-form-row">
          <div className="cf-form-group">
            <label className="cf-label" htmlFor="cf-name">
              Your Name <span className="cf-required">*</span>
            </label>
            <input
              id="cf-name"
              className="cf-input"
              type="text"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              disabled={loading}
            />
          </div>
        </div>
        <div className="cf-form-group">
          <label className="cf-label" htmlFor="cf-text">
            Your Comment <span className="cf-required">*</span>
          </label>
          <textarea
            id="cf-text"
            className="cf-textarea"
            placeholder="Share your thoughts, questions, or experiences…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={5}
            disabled={loading}
          />
          <div className="cf-char-count">{text.length} / 2000</div>
        </div>

        {error && (
          <div className="cf-alert cf-alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}
        {success && (
          <div className="cf-alert cf-alert-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Comment posted! Thank you for your feedback.
          </div>
        )}

        <button
          type="submit"
          id="cf-submit-btn"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: "0.5rem" }}
        >
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "cf-spin 0.8s linear infinite" }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
              </svg>
              Posting…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Submit Comment
            </>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export default function CommentsSection() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback/comments", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load comments");
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

  return (
    <div className="cf-wrapper">
      {/* Post a Comment */}
      <NewCommentForm onSuccess={fetchComments} />

      {/* Comments List */}
      <div className="cf-list-section">
        <div className="cf-list-header">
          <h2 className="cf-list-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Community Comments
          </h2>
          {!loading && !error && (
            <span className="cf-count-badge">
              {comments.length} {comments.length === 1 ? "comment" : "comments"}
            </span>
          )}
        </div>

        {loading && (
          <div className="cf-loading">
            <div className="cf-spinner" />
            <p>Loading comments…</p>
          </div>
        )}

        {!loading && error && (
          <div className="cf-alert cf-alert-error" style={{ marginBottom: "1.5rem" }}>
            {error} —{" "}
            <button className="cf-link-btn" onClick={fetchComments}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && comments.length === 0 && (
          <div className="cf-empty">
            <div className="cf-empty-icon">💬</div>
            <h3>No comments yet</h3>
            <p>Be the first to share your thoughts!</p>
          </div>
        )}

        {!loading && !error && comments.length > 0 && (
          <div className="cf-comments-list">
            {comments.map((comment) => (
              <CommentCard
                key={comment._id}
                comment={comment}
                onRefresh={fetchComments}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scoped Animation */}
      <style jsx global>{`
        @keyframes cf-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
