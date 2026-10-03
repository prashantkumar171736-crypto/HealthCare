"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ARCHIVE_RETENTION_OPTIONS } from "@/lib/archive-config";

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
  lastResults: ArchiveRunResult[];
}

interface ArchiveRunResult {
  category: string;
  status: "success" | "failed";
  fileName?: string;
  recordsCount: number;
  preview: Record<string, unknown>[];
  error?: string;
}

export default function DataArchivePage() {
  const [status, setStatus] = useState<ArchiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [results, setResults] = useState<ArchiveRunResult[]>([]);

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
      setResults(Array.isArray(data?.lastResults) ? data.lastResults : []);
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
      if (Array.isArray(data?.results)) setResults(data.results);
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

  async function saveSettings(updates: { enabled?: boolean; retentionDays?: number }) {
    try {
      setSavingSettings(true);
      setError("");
      const res = await fetch("/api/admin/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to save archive settings.");
      setStatus((current) => current ? { ...current, ...data } : current);
      if (typeof data.retentionDays === "number") setRetentionDays(data.retentionDays);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save archive settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  const archiveScope = [
    {
      label: "Live Access Logs",
      value: `Last ${ARCHIVE_RETENTION_OPTIONS.find((option) => option.days === (status?.retentionDays ?? 30))?.label ?? "30 days"}`,
    },
    { label: "IP security", value: "Blocked and failed-attempt history" },
    { label: "Server logs", value: "Exported only when durable logs are captured" },
    { label: "Format", value: "Excel (.xlsx)" },
    { label: "Bucket", value: status?.bucketName || "healthcare-ip-security" },
  ];

  const metricCards = [
    { label: "Archive status", value: status?.enabled ? "Enabled" : "Disabled", tone: "success" },
    { label: "Last archive run", value: status?.lastRun ? new Date(status.lastRun).toLocaleString() : "Never", tone: "warning" },
    { label: "Export trigger", value: "Manual run", tone: "info" },
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
              <span
                className={`archive-run-button-wrap${!status?.enabled ? " archive-run-disabled" : ""}`}
                title={!status?.enabled ? "Enable the archive switch before starting an export." : undefined}
              >
                <button type="button" className="archive-btn archive-btn-primary" onClick={() => void runArchiveNow()} disabled={running || savingSettings || !status?.enabled}>
                  {running ? "Running…" : "Run archive now"}
                </button>
              </span>
              <Link href="/admin" className="archive-btn archive-btn-secondary">
                Back to dashboard
              </Link>
            </div>
          </div>

          <div className="archive-controls">
            <label className="archive-retention-label">
              Export time window
              <select
                value={retentionDays}
                disabled={savingSettings}
                onChange={(event) => void saveSettings({ retentionDays: Number(event.target.value) })}
              >
                {ARCHIVE_RETENTION_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="archive-switch">
              <input
                type="checkbox"
                role="switch"
                checked={status?.enabled ?? false}
                disabled={savingSettings || loading}
                onChange={(event) => void saveSettings({ enabled: event.target.checked })}
              />
              <span className="archive-switch-track" aria-hidden="true"><span /></span>
              <span className="archive-switch-label">{status?.enabled ? "Enabled" : "Disabled"}</span>
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

              {results.length > 0 ? (
                <section className="archive-results-panel" aria-live="polite">
                  <h3>Latest export preview</h3>
                  <div className="archive-result-list">
                    {results.map((result) => {
                      const columns = Object.keys(result.preview[0] ?? {}).slice(0, 6);
                      return (
                        <article className="archive-result-card" key={result.category}>
                          <div className="archive-result-heading">
                            <strong>{result.category}</strong>
                            <span>{result.status === "success" ? "Completed" : "Failed"} · {result.recordsCount} records</span>
                          </div>
                          {result.fileName && result.status === "success" ? (
                            <a className="archive-btn archive-btn-secondary" href={`/api/admin/archive?file=${encodeURIComponent(result.fileName)}`}>
                              Export {result.fileName}
                            </a>
                          ) : null}
                          {result.error ? <p className="archive-result-error">{result.error}</p> : null}
                          {columns.length > 0 ? (
                            <div className="archive-preview-scroll">
                              <table className="archive-preview-table">
                                <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                                <tbody>
                                  {result.preview.map((row, rowIndex) => (
                                    <tr key={`${result.category}-${rowIndex}`}>
                                      {columns.map((column) => (
                                        <td key={column}>{typeof row[column] === "string" ? row[column] as string : JSON.stringify(row[column])}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : <p className="archive-result-empty">No records in this time window.</p>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <div className="archive-panels-grid">
                <div className="archive-panel-box">
                  <h3>Archives in bucket</h3>

                  {status && status.files.length > 0 ? (
                    <div className="archive-file-list">
                      {status.files.map((file) => {
                        return (
                          <div key={file.key} className="archive-file-row">
                            <div>
                              <div className="archive-file-name">{file.key}</div>
                              <div className="archive-file-meta">
                                {file.size} bytes • {file.lastModified ? new Date(file.lastModified).toLocaleString() : "Unknown time"}
                              </div>
                            </div>
                            <a href={`/api/admin/archive?file=${encodeURIComponent(file.key)}`} className="archive-link" download>Export</a>
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

        .archive-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .archive-run-button-wrap {
          display: inline-flex;
        }

        .archive-run-disabled {
          cursor: not-allowed;
        }

        .archive-run-disabled > button:disabled {
          pointer-events: none;
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

        .archive-retention-label select {
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: #fff;
          color: #0f172a;
          font-weight: 700;
          font-size: 0.95rem;
        }

        .archive-switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
        }

        .archive-switch input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
        }

        .archive-switch-track {
          position: relative;
          width: 42px;
          height: 24px;
          border-radius: 999px;
          background: #94a3b8;
          transition: background 0.2s ease;
        }

        .archive-switch-track > span {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.28);
          transition: transform 0.2s ease;
        }

        .archive-switch input:checked + .archive-switch-track {
          background: #0d9488;
        }

        .archive-switch input:checked + .archive-switch-track > span {
          transform: translateX(18px);
        }

        .archive-switch input:focus-visible + .archive-switch-track {
          outline: 3px solid rgba(13, 148, 136, 0.3);
          outline-offset: 2px;
        }

        .archive-switch input:disabled ~ .archive-switch-label {
          opacity: 0.6;
        }

        .archive-controls {
          gap: 20px;
          flex-wrap: wrap;
        }

        .archive-results-panel {
          margin-bottom: 20px;
          padding: 16px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 14px;
          background: rgba(255,255,255,0.46);
        }

        .archive-results-panel > h3 {
          margin: 0 0 12px;
        }

        .archive-result-list {
          display: grid;
          gap: 12px;
        }

        .archive-result-card {
          min-width: 0;
          padding: 12px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 10px;
        }

        .archive-result-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          text-transform: capitalize;
        }

        .archive-result-error { color: #b91c1c; }
        .archive-result-empty { color: #64748b; }
        .archive-preview-scroll { overflow-x: auto; margin-top: 12px; }
        .archive-preview-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        .archive-preview-table th,
        .archive-preview-table td {
          max-width: 260px;
          padding: 7px 9px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          text-align: left;
          overflow-wrap: anywhere;
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
