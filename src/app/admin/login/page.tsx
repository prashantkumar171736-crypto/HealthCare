"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.status === 429) {
        // Rate-limited / locked out
        setLocked(true);
        setError(data.error || "Too many failed attempts. Please wait before trying again.");
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const ms = parseInt(retryAfter, 10) * 1000;
          setTimeout(() => {
            setLocked(false);
            setError("");
          }, ms);
        }
        return;
      }

      if (res.ok && data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div
      style={{
        minHeight: "90vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #f8fafc)",
        padding: "2rem",
        color: "var(--text-main, #0f172a)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "20px",
          padding: "2.5rem",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <span style={{ fontSize: "3rem" }}>🛡️</span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text-main, #0f172a)",
              marginTop: "0.5rem",
              marginBottom: "0.25rem",
              letterSpacing: "-0.025em",
            }}
          >
            Admin Access
          </h1>
          <p style={{ color: "var(--text-muted, #475569)", fontSize: "0.9rem" }}>
            HealthEdu GUI Control Panel
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#dc2626",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontSize: "0.85rem",
              marginBottom: "1.5rem",
              lineHeight: 1.4,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-main, #334155)",
                marginBottom: "0.5rem",
              }}
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1.5px solid #cbd5e1",
                color: "#0f172a",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              placeholder="Enter admin username"
              className="login-input"
            />
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-main, #334155)",
                marginBottom: "0.5rem",
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1.5px solid #cbd5e1",
                color: "#0f172a",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              placeholder="Enter admin password"
              className="login-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading || locked}
            style={{
              width: "100%",
              padding: "0.85rem",
              borderRadius: "8px",
              backgroundColor: locked ? "#6b7280" : "var(--primary, #0d9488)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.95rem",
              border: "none",
              cursor: loading || locked ? "not-allowed" : "pointer",
              transition: "transform 0.15s, opacity 0.2s",
              boxShadow: locked ? "none" : "0 4px 12px rgba(13, 148, 136, 0.25)",
              opacity: loading || locked ? 0.7 : 1,
            }}
          >
            {locked ? "🔒 Account Temporarily Locked" : loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link
            href="/"
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted, #64748b)",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "var(--primary, #0d9488)")}
            onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-muted, #64748b)")}
          >
            ← Back to website
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .login-input:focus {
          border-color: var(--primary, #0d9488) !important;
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.18) !important;
        }
      `}</style>
    </div>
  );
}
