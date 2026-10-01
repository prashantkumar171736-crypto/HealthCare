"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ArchiveFileItem {
  key: string;
  size: number;
  lastModified: string;
}

interface ArchiveStatus {
  enabled: boolean;
  bucketName: string;
  retentionDays: number;
  lastRun: string | null;
  nextRun: string;
  files: ArchiveFileItem[];
  totalFiles: number;
}

export default function DataArchivePage() {
  const [status, setStatus] = useState<ArchiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);

  async function loadStatus() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/archive", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load archive status.");
      }
      setStatus(data);
      setRetentionDays(Number(data?.retentionDays ?? 30));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load archive status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function runArchiveNow() {
    try {
      setRunning(true);
      setError("");
      const res = await fetch("/api/admin/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "all", retentionDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Archive export failed.");
      }
      await loadStatus();
      return data;
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Archive export failed.");
      return null;
    } finally {
      setRunning(false);
    }
  }

  const archiveScope = [
    { label: "Analytics", value: `Older than ${status?.retentionDays ?? 30} days` },
    { label: "IP security", value: "Blocked and failed-attempt history" },
    { label: "Server logs", value: "Exported only when durable logs are captured" },
    { label: "Format", value: "Excel (.xls)" },
    { label: "Bucket", value: status?.bucketName || "healthcare-ip-security" },
  ];

  const metricCards = [
    { label: "Archive status", value: status?.enabled ? "Enabled" : "Disabled", tone: "success" },
    { label: "Last archive run", value: status?.lastRun ? new Date(status.lastRun).toLocaleString() : "Never", tone: "warning" },
    { label: "Next scheduled run", value: status?.nextRun || "Monthly (default schedule)", tone: "info" },
    { label: "Bucket", value: status?.bucketName || "healthcare-ip-security", tone: "success" },
    { label: "Retention", value: `${status?.retentionDays ?? 30} days`, tone: "success" },
    { label: "Archived files", value: String(status?.totalFiles ?? 0), tone: "warning" },
  ];

  return (
    <>
      <section className="archive-admin-root">
        <div className="archive-admin-shell">
          <div className="archive-badge">DATA ARCHIVE</div>

          <div className="archive-header-row">
            <h1>Archive &amp; retention</h1>
            <div className="archive-actions">
              <button type="button" className="archive-btn archive-btn-primary" onClick={() => void runArchiveNow()} disabled={running}>
                {running ? "Running…" : "Run archive now"}
              </button>
              <Link href="/admin" className="archive-btn archive-btn-secondary">
                Back to dashboard
              </Link>
            </div>
          </div>

          <div className="archive-controls">
            <label className="archive-retention-label">
              Retention days
              <input
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                onChange={(event) => setRetentionDays(Number(event.target.value || 30))}
              />
            </label>
          </div>

          {error ? <p className="archive-error" role="alert">{error}</p> : null}

          {loading ? (
            <div className="archive-loading">Loading archive status…</div>
          ) : (
            <>
              <div className="archive-metrics-grid">
                {metricCards.map((card) => (
                  <div key={card.label} className={`archive-metric-card archive-tone-${card.tone}`}>
                    <div className="archive-metric-label">{card.label}</div>
                    <div className="archive-metric-value">{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="archive-panels-grid">
                <div className="archive-panel-box">
                  <h3>Archives in bucket</h3>

                  {status && status.files.length > 0 ? (
                    <div className="archive-file-list">
                      {status.files.map((file) => {
                        const fileUrl = `${status.bucketName === "healthcare-ip-security" ? "https://pub-8ded07f2075a43daaa93fc2d473091fb.r2.dev" : ""}/${file.key}`;
                        const link = fileUrl.startsWith("https://") ? fileUrl : "#";

                        return (
                          <div key={file.key} className="archive-file-row">
                            <div>
                              <div className="archive-file-name">{file.key}</div>
                              <div className="archive-file-meta">
                                {file.size} bytes • {file.lastModified ? new Date(file.lastModified).toLocaleString() : "Unknown time"}
                              </div>
                            </div>
                            {link !== "#" ? (
                              <a href={link} target="_blank" rel="noreferrer" className="archive-link">Download</a>
                            ) : (
                              <span className="archive-pill warning">Available in bucket</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="archive-empty">No archived Excel files have been uploaded yet.</div>
                  )}
                </div>

                <div className="archive-panel-box">
                  <h3>Archive scope</h3>
                  <div className="archive-scope-list">
                    {archiveScope.map((item) => (
                      <div key={item.label} className="archive-scope-row">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx global>{`
        .archive-admin-root {
          min-height: 100vh;
          background: linear-gradient(180deg, #eef3f6 0%, #eef2f3 100%);
          color: #1f2937;
          padding: 36px 20px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .archive-admin-shell {
          max-width: 1280px;
          margin: 0 auto;
          background: rgba(255,255,255,0.2);
          border-radius: 18px;
          padding: 20px 16px 12px;
        }

        .archive-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: rgba(15, 118, 110, 0.13);
          border: 1px solid rgba(13, 148, 136, 0.25);
          color: #0f766e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          padding: 7px 10px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .archive-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .archive-header-row h1 {
          margin: 0;
          font-size: clamp(2rem, 2.1vw, 3rem);
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #0f172a;
          font-weight: 800;
        }

        .archive-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .archive-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 0.93rem;
          font-weight: 700;
          text-decoration: none;
          border: 1px solid transparent;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .archive-btn-primary {
          background: linear-gradient(135deg, #14b8a6, #0ea5a4);
          color: white;
          box-shadow: 0 10px 18px rgba(20, 184, 166, 0.22);
        }

        .archive-btn-primary:hover {
          filter: brightness(1.04);
        }

        .archive-btn-secondary {
          background: #ffffff;
          color: #334155;
          border-color: rgba(148, 163, 184, 0.45);
        }

        .archive-btn-secondary:hover {
          background: #f8fafc;
        }

        .archive-controls {
          display: flex;
          align-items: center;
          margin-bottom: 18px;
        }

        .archive-retention-label {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #475569;
          font-weight: 600;
          font-size: 0.92rem;
        }

        .archive-retention-label input {
          width: 92px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: rgba(255,255,255,0.7);
          color: #0f172a;
          font-weight: 700;
          font-size: 0.95rem;
        }

        .archive-error {
          margin: 0 0 18px;
          color: #b91c1c;
          background: rgba(254, 226, 226, 0.8);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 10px;
          padding: 10px 12px;
          font-weight: 600;
        }

        .archive-loading {
          padding: 20px 0;
          color: #475569;
          font-weight: 600;
        }

        .archive-metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(180px, 1fr));
          gap: 14px;
          margin-bottom: 24px;
        }

        @media (max-width: 1200px) {
          .archive-metrics-grid {
            grid-template-columns: repeat(2, minmax(180px, 1fr));
          }
        }

        @media (max-width: 640px) {
          .archive-metrics-grid {
            grid-template-columns: 1fr;
          }
        }

        .archive-metric-card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0.18));
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 14px;
          padding: 16px 18px;
          min-height: 118px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
        }

        .archive-tone-success {
          border-color: rgba(16, 185, 129, 0.25);
        }

        .archive-tone-warning {
          border-color: rgba(245, 158, 11, 0.25);
        }

        .archive-tone-info {
          border-color: rgba(59, 130, 246, 0.25);
        }

        .archive-metric-label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.72rem;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 10px;
        }

        .archive-metric-value {
          font-size: clamp(1.25rem, 1.6vw, 2.1rem);
          line-height: 1.2;
          font-weight: 800;
          color: #10b981;
          word-break: break-word;
        }

        .archive-tone-warning .archive-metric-value {
          color: #f59e0b;
        }

        .archive-tone-info .archive-metric-value {
          color: #2563eb;
        }

        .archive-panels-grid {
          display: grid;
          grid-template-columns: 1.45fr 0.9fr;
          gap: 18px;
          margin-top: 4px;
        }

        @media (max-width: 920px) {
          .archive-panels-grid {
            grid-template-columns: 1fr;
          }
        }

        .archive-panel-box {
          background: rgba(255,255,255,0.46);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          padding: 18px 18px 14px;
          min-height: 260px;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
        }

        .archive-panel-box h3 {
          margin: 0 0 18px;
          font-size: 1.05rem;
          font-weight: 800;
          color: #1f2937;
        }

        .archive-file-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .archive-file-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: rgba(255,255,255,0.25);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 12px;
          padding: 10px 12px;
        }

        .archive-file-name {
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
          word-break: break-word;
        }

        .archive-file-meta {
          color: #64748b;
          font-size: 0.8rem;
        }

        .archive-link {
          color: #0f766e;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
        }

        .archive-link:hover {
          text-decoration: underline;
        }

        .archive-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .archive-pill.warning {
          background: rgba(245, 158, 11, 0.12);
          color: #a16207;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .archive-empty {
          color: #64748b;
          font-weight: 500;
          padding-top: 4px;
        }

        .archive-scope-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .archive-scope-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.24);
          color: #334155;
        }

        .archive-scope-row:last-child {
          border-bottom: none;
        }

        .archive-scope-row span {
          color: #475569;
          font-weight: 600;
        }

        .archive-scope-row strong {
          text-align: right;
          color: #0f172a;
          font-weight: 700;
          font-size: 0.9rem;
        }
      `}</style>
    </>
  );
}
