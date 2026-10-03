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
  filesError?: string;
  lastResults: ArchiveRunResult[];
}

interface ArchiveRunResult {
  jobId: string;
  category: string;
  status: "success" | "failed" | "processing" | "pending";
  fileName: string;
  fileSizeBytes: number | null;
  recordsCount: number;
  archivedAt: string;
  error?: string;
}

interface ArchiveRunFeedback {
  status: "success" | "failed";
  message: string;
}

const ARCHIVE_PREVIEW_CATEGORIES = [
  { key: "analytics", label: "Analytics" },
  { key: "ip-security", label: "IP Security" },
  { key: "server-logs", label: "Server Logs" },
] as const;

function formatArchiveDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatArchivedAt(value: string | null | undefined): string {
  if (!value) return "Not available";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

function formatFileSize(size: number | null | undefined): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return "Not available";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getArchiveStatusLabel(status: ArchiveRunResult["status"]): string {
  if (status === "success") return "Completed";
  if (status === "failed") return "Failed";
  return status === "processing" ? "Processing" : "Pending";
}

function getArchiveRunFeedback(results: ArchiveRunResult[], bucketName: string): ArchiveRunFeedback {
  const failedCategories = results.filter((result) => result.status === "failed");
  if (results.length > 0 && failedCategories.length === 0) {
    return {
      status: "success",
      message: `Export file generated and uploaded on R2 ${bucketName} Bucket successfully.`,
    };
  }

  const categoryNames = failedCategories.map((result) => result.category).join(", ");
  return {
    status: "failed",
    message: `Export processing failed. File not uploaded on R2 ${bucketName} Bucket for: ${categoryNames}.`,
  };
}

export default function DataArchivePage() {
  const [status, setStatus] = useState<ArchiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [results, setResults] = useState<ArchiveRunResult[]>([]);
  const [runFeedback, setRunFeedback] = useState<ArchiveRunFeedback | null>(null);

  useEffect(() => {
    if (!runFeedback || running) return;
    const timeoutId = window.setTimeout(() => setRunFeedback(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [runFeedback, running]);

  async function loadStatus(showLoading = false) {
    try {
      if (showLoading) setLoading(true);
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
    void loadStatus(true);
  }, []);

  async function runArchiveNow() {
    try {
      setRunning(true);
      setRunFeedback(null);
      setError("");
      const res = await fetch("/api/admin/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "all", retentionDays }),
      });
      const data = await res.json();
      if (Array.isArray(data?.results)) {
        setResults(data.results);
        setRunFeedback(getArchiveRunFeedback(data.results, data.bucketName || status?.bucketName || "archive"));
      } else {
        setRunFeedback({
          status: "failed",
          message: `Export processing failed. File not uploaded on R2 ${status?.bucketName || "archive"} Bucket.`,
        });
      }
      if (!res.ok) {
        throw new Error(data?.error || "Archive export failed.");
      }
      await loadStatus();
      return data;
    } catch (runError) {
      setRunFeedback((current) => current ?? {
        status: "failed",
        message: `Export processing failed. File not uploaded on R2 ${status?.bucketName || "archive"} Bucket.`,
      });
      setError(runError instanceof Error ? runError.message : "Archive export failed.");
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function saveSettings(updates: { enabled?: boolean; retentionDays?: number }) {
    const previousStatus = status;
    if (previousStatus) setStatus({ ...previousStatus, ...updates });
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
      if (previousStatus) setStatus(previousStatus);
      setError(saveError instanceof Error ? saveError.message : "Unable to save archive settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function clearArchiveEntry(jobId: string, fileName: string) {
    if (!window.confirm(`Clear the MongoDB entry for "${fileName}"? This will not delete the file from R2.`)) return;

    try {
      setError("");
      const res = await fetch(`/api/admin/archive?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Unable to clear the archive entry.");
      setResults((current) => current.filter((result) => result.jobId !== jobId));
      await loadStatus();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Unable to clear the archive entry.");
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
              <div className="archive-run-feedback-slot">
                {running ? (
                  <div className="archive-run-progress" role="status" aria-live="polite" aria-busy="true">
                    <span>Processing…</span>
                    <span className="archive-run-progress-track" aria-hidden="true"><span /></span>
                  </div>
                ) : runFeedback ? (
                  <div
                    className={`archive-run-feedback ${runFeedback.status}`}
                    title={runFeedback.message}
                    role="status"
                    aria-live="polite"
                  >
                    <span className="archive-run-feedback-icon" aria-hidden="true">
                      {runFeedback.status === "success" ? "✓" : "×"}
                    </span>
                    <span>{runFeedback.message}</span>
                  </div>
                ) : <span className="archive-run-feedback-placeholder" aria-hidden="true" />}
              </div>
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
            <div className="archive-switch">
              <button
                type="button"
                role="switch"
                aria-checked={status?.enabled ?? false}
                aria-label="Enable data archive exports"
                disabled={savingSettings || loading || !status}
                onClick={() => {
                  if (status) void saveSettings({ enabled: !status.enabled });
                }}
              >
                <span className="archive-switch-track" aria-hidden="true"><span /></span>
              </button>
              <span className="archive-switch-label">{status?.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          </div>

          {error ? <p className="archive-error" role="alert">{error}</p> : null}
          {status?.filesError ? <p className="archive-error" role="status">Archive file listing unavailable: {status.filesError}</p> : null}

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

              {results.length > 0 || status?.lastRun ? (
                <section className="archive-results-panel" aria-live="polite">
                  <div className="archive-results-header">
                    <h3>Latest export preview</h3>
                    <p>Latest run: {formatArchiveDateTime(status?.lastRun)}</p>
                  </div>
                  {ARCHIVE_PREVIEW_CATEGORIES.map((category) => {
                    const categoryResults = results.filter((result) => result.category === category.key);
                    return (
                      <div className="archive-run-category" key={category.key}>
                        <h4>{category.label}</h4>
                        <div className="archive-run-table-scroll">
                          <table className="archive-run-table">
                            <thead>
                              <tr>
                                <th scope="col">Record ID</th>
                                <th scope="col">Name</th>
                                <th scope="col">File Size</th>
                                <th scope="col">Status</th>
                                <th scope="col">Records</th>
                                <th scope="col">Archived At</th>
                                <th scope="col">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryResults.map((result) => (
                                <tr key={result.jobId}>
                                  <td className="archive-run-id">{result.jobId}</td>
                                  <td>
                                    {result.fileName && result.status === "success" ? (
                                      <a href={`/api/admin/archive?file=${encodeURIComponent(result.fileName)}`} download>
                                        {result.fileName}
                                      </a>
                                    ) : result.fileName}
                                    {result.error ? <span className="archive-run-error">{result.error}</span> : null}
                                  </td>
                                  <td>{formatFileSize(result.fileSizeBytes)}</td>
                                  <td>
                                    <span className={`archive-run-status ${result.status}`}>
                                      {getArchiveStatusLabel(result.status)}
                                    </span>
                                  </td>
                                  <td>{result.recordsCount}</td>
                                  <td>{formatArchivedAt(result.archivedAt)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="archive-clear-button"
                                      onClick={() => void clearArchiveEntry(result.jobId, result.fileName)}
                                      title="Clear this MongoDB entry only; the R2 file will remain."
                                    >
                                      Clear
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {categoryResults.length === 0 ? (
                                <tr><td colSpan={7} className="archive-category-empty">No export entry in this run.</td></tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                    {results.length === 0 ? <p className="archive-result-empty">All entries for this run have been cleared from MongoDB. R2 files are unchanged.</p> : null}
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

        .archive-run-feedback-slot {
          width: min(280px, 100%);
          min-height: 76px;
          flex: 0 0 min(280px, 100%);
          display: flex;
          align-items: stretch;
        }

        .archive-run-feedback-placeholder {
          display: block;
          width: 100%;
          min-height: 76px;
        }

        .archive-run-progress {
          display: grid;
          gap: 8px;
          width: 100%;
          min-height: 76px;
          box-sizing: border-box;
          padding: 10px 13px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 5px 14px rgba(15, 23, 42, 0.1);
          color: #334155;
          font-size: 0.82rem;
          font-weight: 750;
        }

        .archive-run-progress-track {
          display: block;
          height: 9px;
          overflow: hidden;
          border-radius: 999px;
          background: #e5e7eb;
        }

        .archive-run-progress-track > span {
          display: block;
          width: 38%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #16a34a, #22c55e, #4ade80);
          animation: archive-progress-slide 1.15s ease-in-out infinite;
        }

        .archive-run-feedback {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          min-height: 88px;
          box-sizing: border-box;
          padding: 12px 16px;
          border: 2px solid;
          border-radius: 16px;
          font-size: 0.84rem;
          font-weight: 750;
          line-height: 1.45;
          overflow-wrap: anywhere;
          box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
        }

        .archive-run-feedback.success {
          border-color: #34d399;
          background: linear-gradient(135deg, #ecfdf5, #f0fdfa);
          color: #064e3b;
        }

        .archive-run-feedback.failed {
          border-color: #fb7185;
          background: linear-gradient(135deg, #fff1f2, #fef2f2);
          color: #881337;
        }

        .archive-run-feedback-icon {
          display: grid;
          flex: 0 0 42px;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 50%;
          color: #fff;
          font-size: 1.8rem;
          font-weight: 800;
          line-height: 1;
        }

        .archive-run-feedback.success .archive-run-feedback-icon {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }

        .archive-run-feedback.failed .archive-run-feedback-icon {
          background: linear-gradient(135deg, #f43f5e, #dc2626);
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.22);
        }

        @media (max-width: 640px) {
          .archive-run-feedback-slot {
            width: 100%;
            flex-basis: 100%;
          }
        }

        @keyframes archive-progress-slide {
          from { transform: translateX(-115%); }
          to { transform: translateX(270%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .archive-run-progress-track > span { animation-duration: 2.5s; }
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
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #334155;
          font-weight: 700;
          cursor: pointer;
        }

        .archive-switch > button {
          display: inline-flex;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: transparent;
          cursor: pointer;
        }

        .archive-switch > button:disabled {
          cursor: not-allowed;
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

        .archive-switch > button[aria-checked="true"] .archive-switch-track {
          background: #0d9488;
        }

        .archive-switch > button[aria-checked="true"] .archive-switch-track > span {
          transform: translateX(18px);
        }

        .archive-switch > button:focus-visible .archive-switch-track {
          outline: 3px solid rgba(13, 148, 136, 0.3);
          outline-offset: 2px;
        }

        .archive-switch > button:disabled ~ .archive-switch-label {
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

        .archive-results-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .archive-results-header p {
          margin: 0 0 12px;
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 600;
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

        .archive-result-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          color: #334155;
          font-size: 0.84rem;
        }

        .archive-result-file {
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .archive-result-status {
          font-weight: 700;
        }

        .archive-result-status.success { color: #047857; }
        .archive-result-status.failed { color: #b91c1c; }

        .archive-clear-button {
          padding: 6px 10px;
          border: 1px solid rgba(220, 38, 38, 0.3);
          border-radius: 8px;
          background: #fff;
          color: #b91c1c;
          font-weight: 700;
          cursor: pointer;
        }

        .archive-clear-button:hover { background: #fef2f2; }

        .archive-run-category { margin-top: 18px; }
        .archive-run-category h4 { margin: 0 0 8px; color: #1f2937; font-size: 0.95rem; font-weight: 800; }
        .archive-run-table-scroll { overflow-x: auto; }
        .archive-run-table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 0.82rem; }
        .archive-run-table th,
        .archive-run-table td {
          padding: 10px 9px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.22);
          text-align: left;
          vertical-align: middle;
        }
        .archive-run-table th { color: #64748b; font-weight: 800; white-space: nowrap; }
        .archive-run-table td { color: #334155; }
        .archive-run-table td a { color: #0f766e; font-weight: 700; overflow-wrap: anywhere; }
        .archive-run-id { max-width: 180px; overflow-wrap: anywhere; font-family: ui-monospace, monospace; font-size: 0.75rem; }
        .archive-run-status { font-weight: 800; white-space: nowrap; }
        .archive-run-status.success { color: #047857; }
        .archive-run-status.failed { color: #b91c1c; }
        .archive-run-status.processing { color: #b45309; }
        .archive-run-status.pending { color: #64748b; }
        .archive-run-error { display: block; max-width: 280px; color: #b91c1c; font-size: 0.76rem; }
        .archive-category-empty { color: #64748b !important; font-style: italic; }

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
