"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Lock, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";

interface SecuritySummary {
  blockedIps: number;
  failedAttemptsToday: number;
  otpEnabled: boolean;
  currentLockoutPolicy: string;
  suspiciousCount: number;
}

interface RecentActivityItem {
  title: string;
  value: string;
  type: "good" | "warning" | "blocked";
}

interface SecurityPolicySnapshot {
  label: string;
  value: string;
}

export default function SecurityOverviewPage() {
  const [summary, setSummary] = useState<SecuritySummary>({
    blockedIps: 0,
    failedAttemptsToday: 0,
    otpEnabled: false,
    currentLockoutPolicy: "N/A",
    suspiciousCount: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [policy, setPolicy] = useState<SecurityPolicySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const [settingsRes, emailRes, ipRes] = await Promise.all([
          fetch("/api/admin/security-settings", { cache: "no-store" }),
          fetch("/api/admin/security/email-settings", { cache: "no-store" }),
          fetch("/api/admin/security/ip-list?page=1&pageSize=10", { cache: "no-store" }),
        ]);

        const settingsData = settingsRes.ok ? await settingsRes.json() : null;
        const emailData = emailRes.ok ? await emailRes.json() : null;
        const ipData = ipRes.ok ? await ipRes.json() : null;

        if (!settingsData && !emailData && !ipData) {
          throw new Error("Unable to load security overview data.");
        }

        const activeBlocked = ipData?.items?.filter((item: { status?: string }) => item.status === "blocked").length ?? 0;
        const failedAttempts = ipData?.items?.reduce((total: number, item: { failedAttempts?: number }) => total + (item.failedAttempts ?? 0), 0) ?? 0;
        const lockoutLabel = settingsData?.blockDurationMinutes
          ? `${settingsData.blockDurationMinutes} min`
          : "N/A";

        const nextSummary: SecuritySummary = {
          blockedIps: activeBlocked,
          failedAttemptsToday: failedAttempts,
          otpEnabled: Boolean(emailData?.requireOtp ?? false),
          currentLockoutPolicy: lockoutLabel,
          suspiciousCount: Math.max(0, Math.min(99, activeBlocked + Math.round(failedAttempts / 5))),
        };

        const recentList: RecentActivityItem[] = [
          {
            title: "Blocked IPs",
            value: `${activeBlocked} currently blocked`,
            type: activeBlocked > 0 ? "blocked" : "good",
          },
          {
            title: "Failed attempts",
            value: `${failedAttempts} recorded in the recent window`,
            type: failedAttempts > 10 ? "warning" : "good",
          },
          {
            title: "Email OTP",
            value: emailData?.requireOtp ? "Required after password verification" : "Disabled",
            type: emailData?.requireOtp ? "good" : "warning",
          },
          {
            title: "Lockout status",
            value: `${lockoutLabel} active restriction`,
            type: settingsData?.blockDurationMinutes ? "good" : "warning",
          },
        ];

        const policySnapshot: SecurityPolicySnapshot[] = [
          { label: "Max failed attempts", value: String(settingsData?.maxFailedAttempts ?? "—") },
          { label: "Attempt window", value: `${settingsData?.attemptWindowMinutes ?? "—"} minutes` },
          { label: "Lock duration", value: `${settingsData?.blockDurationMinutes ?? "—"} minutes` },
          { label: "OTP expiry", value: `${emailData?.otpExpiryMinutes ?? "—"} minutes` },
          { label: "Resend cooldown", value: `${emailData?.resendCooldownSeconds ?? "—"} seconds` },
        ];

        if (!active) return;
        setSummary(nextSummary);
        setRecentActivity(recentList);
        setPolicy(policySnapshot);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load security overview.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOverview();
    return () => { active = false; };
  }, []);

  const healthStatus = useMemo(() => {
    if (summary.blockedIps > 0 || summary.failedAttemptsToday > 20 || !summary.otpEnabled) {
      return { label: "Warning", tone: "warning", message: "Some protection checks need attention. Review lockouts and OTP policy." };
    }
    if (summary.blockedIps === 0 && summary.failedAttemptsToday <= 5 && summary.otpEnabled) {
      return { label: "Good", tone: "good", message: "Security controls are active and the environment looks stable." };
    }
    return { label: "Critical", tone: "critical", message: "Security posture requires review to prevent abuse or repeated lockout cycles." };
  }, [summary]);

  const lastUpdated = new Date().toLocaleString();

  if (loading) {
    return <section className="security-overview-panel"><p>Loading security overview…</p></section>;
  }

  return (
    <section className="security-overview-panel">
      <div className="security-overview-header">
        <div>
          <span className="security-overview-badge"><ShieldCheck size={14} /> Security status</span>
          <h2>Security Overview</h2>
        </div>

        <div className="security-overview-actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>Refresh</button>
          <Link className="primary" href="/admin/security/ip-settings">Open IP Settings</Link>
          <Link href="/admin/security/email-login">Open Email Login</Link>
        </div>
      </div>

      <div style={{ marginBottom: 18, color: "var(--text-muted)", fontSize: "0.85rem" }}>
        <Clock3 size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
        Last updated: {lastUpdated}
      </div>

      {error ? <p className="security-feedback error" role="alert">{error}</p> : null}

      <div className="security-metrics-grid">
        <div className="security-metric-card blocked">
          <div className="security-metric-label">Active blocked IPs</div>
          <div className="security-metric-value">{summary.blockedIps}</div>
        </div>

        <div className="security-metric-card warning">
          <div className="security-metric-label">Failed attempts today</div>
          <div className="security-metric-value">{summary.failedAttemptsToday}</div>
        </div>

        <div className={`security-metric-card ${summary.otpEnabled ? "good" : "warning"}`}>
          <div className="security-metric-label">Email OTP status</div>
          <div className="security-metric-value">{summary.otpEnabled ? "Enabled" : "Disabled"}</div>
        </div>

        <div className="security-metric-card good">
          <div className="security-metric-label">Current lockout policy</div>
          <div className="security-metric-value">{summary.currentLockoutPolicy}</div>
        </div>

        <div className="security-metric-card warning">
          <div className="security-metric-label">Suspicious activity</div>
          <div className="security-metric-value">{summary.suspiciousCount}</div>
        </div>
      </div>

      <div className="security-overview-health">
        <div className={`security-health-status ${healthStatus.tone}`}>
          {healthStatus.tone === "good" ? <ShieldCheck size={18} /> : healthStatus.tone === "warning" ? <AlertTriangle size={18} /> : <ShieldAlert size={18} />}
          {healthStatus.label}
        </div>
        <div style={{ color: "var(--text-muted)", maxWidth: 700 }}>{healthStatus.message}</div>
      </div>

      <div className="security-overview-columns">
        <div className="security-panel-box">
          <h3>Recent security activity</h3>
          <div className="security-list">
            {recentActivity.map((item) => (
              <div key={item.title} className="security-list-item">
                <div>
                  <strong>{item.title}</strong>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: 4 }}>{item.value}</div>
                </div>
                <span className={`security-list-tag ${item.type}`}>{item.type === "blocked" ? "Blocked" : item.type === "warning" ? "Review" : "Healthy"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="security-panel-box">
          <h3>Policy snapshot</h3>
          <div className="security-policy-list">
            {policy.map((item) => (
              <div key={item.label} className="security-policy-row">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
