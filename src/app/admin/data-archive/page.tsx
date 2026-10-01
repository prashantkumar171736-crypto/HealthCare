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

  return (
    <section className="security-page-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div className="security-overview-badge" style={{ display: "inline-flex", marginBottom: 8 }}>🗂️ Data Archive</div>
          <h2 style={{ margin: 0 }}>Archive & retention</h2>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="primary" onClick={() => void runArchiveNow()} disabled={running}>
            {running ? "Running…" : "Run archive now"}
          </button>
          <Link href="/admin" className="secondary-link">Back to dashboard</Link>
        </div>
      </div>

      {error ? <p className="security-feedback error" role="alert">{error}</p> : null}

      {loading ? (
        <p>Loading archive status…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
              Retention days
              <input
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                onChange={(event) => setRetentionDays(Number(event.target.value || 30))}
                style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(15,23,42,0.35)", color: "#f8fafc" }}
              />
            </label>
          </div>

          <div className="security-metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <div className="security-metric-card good">
              <div className="security-metric-label">Archive status</div>
              <div className="security-metric-value">{status?.enabled ? "Enabled" : "Disabled"}</div>
            </div>

            <div className="security-metric-card warning">
              <div className="security-metric-label">Last archive run</div>
              <div className="security-metric-value">{status?.lastRun ? new Date(status.lastRun).toLocaleString() : "Never"}</div>
            </div>

            <div className="security-metric-card blocked">
              <div className="security-metric-label">Next scheduled run</div>
              <div className="security-metric-value">{status?.nextRun || "Monthly schedule"}</div>
            </div>

            <div className="security-metric-card good">
              <div className="security-metric-label">Bucket</div>
              <div className="security-metric-value">{status?.bucketName || "healthcare-ip-security"}</div>
            </div>

            <div className="security-metric-card good">
              <div className="security-metric-label">Retention</div>
              <div className="security-metric-value">{status?.retentionDays ?? 30} days</div>
            </div>

            <div className="security-metric-card warning">
              <div className="security-metric-label">Archived files</div>
              <div className="security-metric-value">{status?.totalFiles ?? 0}</div>
            </div>
          </div>

          <div className="security-overview-columns" style={{ marginTop: 24 }}>
            <div className="security-panel-box">
              <h3>Archives in bucket</h3>
              {status && status.files.length > 0 ? (
                <div className="security-list">
                  {status.files.map((file) => {
                    const fileUrl = `${status.bucketName === "healthcare-ip-security" ? "https://pub-8ded07f2075a43daaa93fc2d473091fb.r2.dev" : ""}/${file.key}`;
                    const link = fileUrl.startsWith("https://") ? fileUrl : "#";

                    return (
                      <div key={file.key} className="security-list-item">
                        <div>
                          <strong>{file.key}</strong>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: 4 }}>
                            {file.size} bytes • {file.lastModified ? new Date(file.lastModified).toLocaleString() : "Unknown time"}
                          </div>
                        </div>
                        {link !== "#" ? (
                          <a href={link} target="_blank" rel="noreferrer" className="secondary-link">Download</a>
                        ) : (
                          <span className="security-list-tag warning">Available in bucket</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)" }}>No archived Excel files have been uploaded yet.</p>
              )}
            </div>

            <div className="security-panel-box">
              <h3>Archive scope</h3>
              <div className="security-policy-list">
                <div className="security-policy-row"><span>Analytics</span><strong>Older than {status?.retentionDays ?? 30} days</strong></div>
                <div className="security-policy-row"><span>IP security</span><strong>Blocked and failed-attempt history</strong></div>
                <div className="security-policy-row"><span>Server logs</span><strong>Exported only when durable logs are captured</strong></div>
                <div className="security-policy-row"><span>Format</span><strong>Excel (.xls)</strong></div>
                <div className="security-policy-row"><span>Bucket</span><strong>{status?.bucketName || "healthcare-ip-security"}</strong></div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
