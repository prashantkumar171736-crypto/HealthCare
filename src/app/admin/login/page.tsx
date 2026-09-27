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
        background: "transparent",
        padding: "2rem",
        color: "#f0fdff",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "rgba(5, 18, 27, 0.82)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid rgba(0, 229, 255, 0.28)",
          borderRadius: "20px",
          padding: "2.5rem",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 229, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
          animation: "fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <span style={{ fontSize: "3rem" }}>🛡️</span>
          <h1
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#00e5ff",
              marginTop: "0.5rem",
              marginBottom: "0.25rem",
              letterSpacing: "-0.025em",
              textShadow: "0 0 20px rgba(0, 229, 255, 0.4)",
            }}
          >
            Admin Access
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            HealthEdu GUI Control Panel
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
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
                color: "#d1d5db",
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
                background: "rgba(5, 20, 30, 0.7)",
                border: "1px solid rgba(0, 229, 255, 0.28)",
                color: "#f0fdff",
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
                color: "#d1d5db",
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
                background: "rgba(5, 20, 30, 0.7)",
                border: "1px solid rgba(0, 229, 255, 0.28)",
                color: "#f0fdff",
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
              backgroundColor: locked ? "#6b7280" : "var(--primary, #00c896)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.95rem",
              border: "none",
              cursor: loading || locked ? "not-allowed" : "pointer",
              transition: "transform 0.15s, opacity 0.2s",
              boxShadow: locked ? "none" : "0 4px 12px rgba(0, 200, 150, 0.3)",
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
              color: "#9ca3af",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#9ca3af")}
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
          border-color: #00e5ff !important;
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
