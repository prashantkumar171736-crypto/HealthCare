"use client";

import { useEffect, useState } from "react";

interface SecurityState {
  otpEnabled: boolean;
  emailOtpConfigured: boolean;
  maskedDestination: string;
  ipRateLimitConfigured: boolean;
}

interface IpBlock {
  id: string;
  fingerprint: string;
  country: string;
  attemptCount: number;
  expiresAt: string;
}

export default function SecuritySettings() {
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const fetchSecurity = async () => {
      try {
        const [settingsResponse, blocksResponse] = await Promise.all([
          fetch("/api/admin/security/settings", { cache: "no-store" }),
          fetch("/api/admin/security/blocks", { cache: "no-store" }),
        ]);
        const settingsData = await settingsResponse.json();
        const blocksData = await blocksResponse.json();
        if (!settingsResponse.ok || !blocksResponse.ok) {
          throw new Error(settingsData.error || blocksData.error || "Unable to load security settings.");
        }
        if (active) {
          setSecurity(settingsData);
          setBlocks(blocksData.blocks || []);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load security settings.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchSecurity();
    return () => { active = false; };
  }, []);

  async function saveOtpSetting(otpEnabled: boolean) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/security/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update OTP setting.");
      setSecurity((current) => current ? { ...current, otpEnabled } : current);
      setMessage(`Email OTP ${otpEnabled ? "enabled" : "disabled"}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update OTP setting.");
    } finally {
      setSaving(false);
    }
  }

  async function testAdminEmail() {
    setTestingEmail(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/security/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Test email failed.");
      setMessage(data.message || "Test email accepted by the SMTP server.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Test email failed.");
    } finally {
      setTestingEmail(false);
    }
  }

  async function unblock(id: string) {
    if (!window.confirm("Unblock this network and reset its failed-login counter?")) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/security/blocks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove block.");
      setBlocks((current) => current.filter((block) => block.id !== id));
    } catch (unblockError) {
      setError(unblockError instanceof Error ? unblockError.message : "Unable to remove block.");
    }
  }

  if (loading) return <div className="panel-card full-panel">Loading security settings...</div>;

  return (
    <div className="panel-card full-panel" style={{ padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Security</h2>
      {error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#34d399" }}>{message}</p>}

      <section style={{ borderBottom: "1px solid var(--admin-input-border)", padding: "12px 0 24px" }}>
        <h3>Admin email verification</h3>
        <p>Email OTP is {security?.emailOtpConfigured ? `configured for ${security.maskedDestination}` : "not configured"}.</p>
        <p>SMTP credentials and the admin destination are read from server environment variables.</p>
        <button
          type="button"
          onClick={() => void testAdminEmail()}
          disabled={testingEmail || saving || !security?.emailOtpConfigured}
        >
          {testingEmail ? "Sending test email..." : "Send test email"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={security?.otpEnabled || false}
            disabled={saving || testingEmail || (!security?.otpEnabled && (!security?.emailOtpConfigured || !security?.ipRateLimitConfigured))}
            onChange={(event) => void saveOtpSetting(event.target.checked)}
          />
          Require email OTP after password verification
        </label>
        {!security?.ipRateLimitConfigured && <p role="alert">Set IP_RATE_LIMIT_SECRET in the deployment environment to enable login security.</p>}
      </section>

      <section style={{ paddingTop: 20 }}>
        <h3>Temporarily blocked networks</h3>
        <p>Blocks use keyed IP fingerprints; raw IPs are neither displayed nor archived.</p>
        {blocks.length === 0 ? <p>No active blocks.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr>
                <th scope="col" style={{ textAlign: "left", padding: 10 }}>Fingerprint</th>
                <th scope="col" style={{ textAlign: "left", padding: 10 }}>Country</th>
                <th scope="col" style={{ textAlign: "left", padding: 10 }}>Attempts</th>
                <th scope="col" style={{ textAlign: "left", padding: 10 }}>Blocked until</th>
                <th scope="col" style={{ textAlign: "right", padding: 10 }}>Action</th>
              </tr></thead>
              <tbody>{blocks.map((block) => (
                <tr key={block.id}>
                  <td style={{ padding: 10, fontFamily: "monospace" }}>{block.fingerprint}</td>
                  <td style={{ padding: 10 }}>{block.country}</td>
                  <td style={{ padding: 10 }}>{block.attemptCount}</td>
                  <td style={{ padding: 10 }}>{new Date(block.expiresAt).toLocaleString()}</td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    <button type="button" onClick={() => void unblock(block.id)}>Unblock</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}