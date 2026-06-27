"use client";

import { useEffect, useState } from "react";

interface DonationConfig {
  upiId: string;
  qrCodeBase64: string;
}

export default function DonationSettings() {
  const [settings, setSettings] = useState<DonationConfig>({
    upiId: "",
    qrCodeBase64: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/donation-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setSettings(data.settings);
          }
        } else {
          setError("Failed to fetch current donation settings.");
        }
      } catch (err) {
        setError("Error connecting to settings API.");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please select a file smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({ ...prev, qrCodeBase64: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSettings((prev) => ({ ...prev, qrCodeBase64: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/donation-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage("UPI & QR Code settings updated successfully!");
      } else {
        setError(data.error || "Failed to save settings.");
      }
    } catch (err) {
      setError("An error occurred while saving donation settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading-settings">Loading config parameters...</div>;
  }

  return (
    <div className="donation-settings-container">
      <h2 className="section-title">💰 Donation & UPI Settings</h2>
      <p className="section-desc">
        Configure the UPI ID and payment QR Code that users will see on the public donation page.
      </p>

      {message && <div className="alert-success">{message}</div>}
      {error && <div className="alert-danger">{error}</div>}

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="form-grid">
          <div className="form-column">
            <h3>UPI & QR Code Details</h3>

            <div className="form-group">
              <label htmlFor="upiId">UPI ID / Address</label>
              <input
                type="text"
                id="upiId"
                name="upiId"
                value={settings.upiId}
                onChange={handleChange}
                placeholder="e.g. donate@upi"
              />
            </div>
          </div>

          {/* Right Column: QR Code upload */}
          <div className="form-column qr-upload-column">
            <h3>Payment QR Code</h3>
            <p className="input-tip">
              Upload your GPay, PhonePe, Paytm, or custom business payment QR Code image.
            </p>

            <div className="qr-preview-box">
              {settings.qrCodeBase64 ? (
                <div className="qr-preview-wrapper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.qrCodeBase64}
                    alt="Uploaded QR Code Preview"
                    className="qr-preview-image"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="btn-remove-qr"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <div className="qr-placeholder">
                  <span>📷</span>
                  <p>No QR Code Uploaded</p>
                </div>
              )}
            </div>

            <div className="file-upload-wrapper">
              <label htmlFor="qrCodeFile" className="btn-file-upload">
                Select QR Image File
              </label>
              <input
                type="file"
                id="qrCodeFile"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-save-settings"
        >
          {saving ? "Saving Changes..." : "Save Donation Settings"}
        </button>
      </form>

      <style jsx>{`
        .donation-settings-container {
          padding: 1rem 0;
          font-family: inherit;
        }
        .section-title {
          font-size: 1.5rem;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }
        .section-desc {
          color: #9ca3af;
          font-size: 0.9rem;
          margin-bottom: 2rem;
        }
        .loading-settings {
          color: #9ca3af;
          padding: 3rem 0;
          text-align: center;
          font-style: italic;
        }
        .alert-success {
          background-color: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .alert-danger {
          background-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .settings-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 3rem;
        }
        @media (max-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }
        .form-column h3 {
          font-size: 1.1rem;
          color: #ffffff;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.5rem;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
        .form-group label {
          font-size: 0.85rem;
          color: #9ca3af;
          font-weight: 600;
        }
        .form-group input {
          background-color: #030712;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #ffffff;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        .form-group input:focus {
          border-color: #00c896;
          outline: none;
        }
        .qr-upload-column {
          display: flex;
          flex-direction: column;
        }
        .input-tip {
          font-size: 0.8rem;
          color: #9ca3af;
          margin-bottom: 1.5rem;
          line-height: 1.4;
        }
        .qr-preview-box {
          background-color: #030712;
          border: 2px dashed rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          height: 250px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          overflow: hidden;
          position: relative;
        }
        .qr-placeholder {
          text-align: center;
          color: #4b5563;
        }
        .qr-placeholder span {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          display: block;
        }
        .qr-placeholder p {
          font-size: 0.85rem;
          margin: 0;
        }
        .qr-preview-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .qr-preview-image {
          max-width: 100%;
          max-height: 170px;
          object-fit: contain;
          border-radius: 6px;
          margin-bottom: 0.75rem;
          background: white;
          padding: 5px;
        }
        .btn-remove-qr {
          background-color: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
          font-size: 0.75rem;
          padding: 0.35rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-remove-qr:hover {
          background-color: #ef4444;
          color: white;
        }
        .file-upload-wrapper {
          display: flex;
          justify-content: center;
        }
        .btn-file-upload {
          background-color: #1f2937;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.65rem 1.25rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          width: 100%;
        }
        .btn-file-upload:hover {
          background-color: #374151;
        }
        .btn-save-settings {
          background-color: #00c896;
          color: #030712;
          font-size: 0.95rem;
          font-weight: 700;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 200, 150, 0.3);
        }
        .btn-save-settings:hover {
          background-color: #00b084;
          transform: translateY(-1px);
        }
        .btn-save-settings:disabled {
          background-color: #4b5563;
          color: #9ca3af;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
      `}</style>
    </div>
  );
}
