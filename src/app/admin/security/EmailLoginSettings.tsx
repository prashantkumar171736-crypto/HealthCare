"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, MailCheck, Send } from "lucide-react";

interface EmailSettings {
  requireOtp: boolean;
  otpExpiryMinutes: number;
  maxOtpAttempts: number;
  resendCooldownSeconds: number;
  emailOtpConfigured: boolean;
  emailProvider: string;
  maskedDestination: string;
}

const DEFAULTS = {
  otpExpiryMinutes: 2,
  maxOtpAttempts: 5,
  resendCooldownSeconds: 60,
};

export default function EmailLoginSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/security/email-settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load email login settings.");
        if (active) setSettings(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load email login settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function updateNumber(key: "otpExpiryMinutes" | "maxOtpAttempts" | "resendCooldownSeconds", value: string) {
    setSettings((current) => current ? { ...current, [key]: Number(value) } : current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/security/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requireOtp: settings.requireOtp,
          otpExpiryMinutes: settings.otpExpiryMinutes,
          maxOtpAttempts: settings.maxOtpAttempts,
          resendCooldownSeconds: settings.resendCooldownSeconds,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save email login settings.");
      setMessage("Email login settings saved. Changes apply to newly requested codes.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save email login settings.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    setTesting(true);
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
      setMessage(data.message || "Test email accepted by the configured provider.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Test email failed.");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <section className="security-panel">Loading email login settings...</section>;
  if (!settings) return <section className="security-panel"><p className="security-feedback error" role="alert">{error || "Unable to load email login settings."}</p></section>;

  return (
    <section className="security-panel">
      <h2 className="security-title">Email Login Settings</h2>
      <form className="security-email-form" onSubmit={save}>
        <section className={`security-email-delivery ${settings.emailOtpConfigured ? "configured" : "unconfigured"}`} aria-label="Email delivery and OTP requirement">
          <div className="security-email-copy">
            <div className="security-email-heading">
              <span className="security-email-icon"><MailCheck size={19} aria-hidden="true" /></span>
              <div>
                <strong>Email delivery</strong>
                <span className={`security-delivery-status ${settings.emailOtpConfigured ? "configured" : "unconfigured"}`}>
                  {settings.emailOtpConfigured ? "Delivery configured" : "Setup required"}
                </span>
              </div>
            </div>
            <p className="security-delivery-note">
              {settings.emailOtpConfigured ? (
                <>Verification codes are sent through <span className="security-provider-chip">{settings.emailProvider}</span> to <span className="security-destination-chip">{settings.maskedDestination}</span>.</>
              ) : (
                "Email codes cannot be delivered yet. Configure the provider credentials and administrator destination in the server environment."
              )}
            </p>
          </div>

          <div className="security-email-controls">
            <button className="security-button test-email-button" type="button" onClick={() => void sendTestEmail()} disabled={testing || !settings.emailOtpConfigured}>
              {testing ? <LoaderCircle className="security-spinner" size={17} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              <span>{testing ? "Sending test email..." : "Send Test Email"}</span>
            </button>
            <div className="security-otp-control">
              <span className="security-otp-label" id="require-email-otp-label">Require email OTP after password verification</span>
              <button
                className={`security-toggle-switch ${settings.requireOtp ? "enabled" : "disabled"}`}
                type="button"
                role="switch"
                aria-labelledby="require-email-otp-label"
                aria-checked={settings.requireOtp}
                disabled={!settings.emailOtpConfigured && !settings.requireOtp}
                onClick={() => setSettings((current) => current ? { ...current, requireOtp: !current.requireOtp } : current)}
              >
                <span className="security-switch-track" aria-hidden="true"><span className="security-switch-thumb" /></span>
                <span className="security-switch-state">{settings.requireOtp ? "Enable" : "Disable"}</span>
              </button>
            </div>
          </div>
        </section>

        <label className="security-setting-row security-field" title="The time limit for each email verification code. A code cannot be used after it expires; request a new code to continue signing in.">
          <span>OTP expiry (minutes)<p>Each emailed code is valid for this many minutes. After it expires, a new code is required to complete sign-in.</p></span>
          <input type="number" min={1} max={10} step={1} required value={settings.otpExpiryMinutes} onChange={(event) => updateNumber("otpExpiryMinutes", event.target.value)} />
        </label>
        <label className="security-setting-row security-field" title="The maximum number of incorrect entries allowed for one verification code. Once reached, that code is invalidated and another code must be requested.">
          <span>Max OTP attempts<p>Incorrect entries permitted for a single code. Reaching this limit invalidates the code, so another must be requested.</p></span>
          <input type="number" min={3} max={10} step={1} required value={settings.maxOtpAttempts} onChange={(event) => updateNumber("maxOtpAttempts", event.target.value)} />
        </label>
        <label className="security-setting-row security-field" title="The minimum wait after a code is sent before another can be requested. This limits repeated email sends while still allowing a replacement after the cooldown.">
          <span>Resend cooldown (seconds)<p>Wait at least this many seconds after sending a code before requesting another. This helps limit repeated sends to the administrator email address.</p></span>
          <input type="number" min={30} max={300} step={1} required value={settings.resendCooldownSeconds} onChange={(event) => updateNumber("resendCooldownSeconds", event.target.value)} />
        </label>

        {error && <p className="security-feedback error" role="alert">{error}</p>}
        {message && <p className="security-feedback" role="status">{message}</p>}
        <div className="security-actions security-actions-centered">
          <button className="security-button primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          <button
            className="security-button reset"
            type="button"
            disabled={saving}
            onClick={() => setSettings((current) => current ? { ...current, ...DEFAULTS } : current)}
          >
            Reset to Default
          </button>
        </div>
      </form>
    </section>
  );
}