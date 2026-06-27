"use client";

import { useState, useEffect } from "react";

interface DonationConfig {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  qrCodeBase64: string;
}

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(250);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"pending" | "processing" | "success">("pending");

  const [donationConfig, setDonationConfig] = useState<DonationConfig | null>(null);

  const presets = [50, 100, 250, 500, 1000];

  useEffect(() => {
    fetch("/api/donation-settings")
      .then((r) => r.json())
      .then((data) => setDonationConfig(data))
      .catch(() => setDonationConfig(null));
  }, []);

  const getFinalAmount = () => {
    if (selectedAmount !== null) return selectedAmount;
    const amt = parseFloat(customAmount);
    return isNaN(amt) ? 0 : amt;
  };

  const handleAmountPresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (val: string) => {
    setSelectedAmount(null);
    setCustomAmount(val);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmt = getFinalAmount();
    if (finalAmt <= 0) {
      alert("Please select or enter a valid donation amount.");
      return;
    }
    setPaymentStep("pending");
    setShowModal(true);
  };

  const startSimulatedPayment = () => {
    setPaymentStep("processing");
    setTimeout(() => setPaymentStep("success"), 2000);
  };

  const resetFlow = () => {
    setShowModal(false);
    setPaymentStep("pending");
  };

  const hasConfig = donationConfig && (
    donationConfig.upiId ||
    donationConfig.qrCodeBase64 ||
    donationConfig.accountNumber
  );

  const hasBankDetails = donationConfig && (
    donationConfig.accountHolder ||
    donationConfig.accountNumber ||
    donationConfig.bankName ||
    donationConfig.ifscCode
  );

  const hasQRCode = donationConfig?.qrCodeBase64;
  const hasUPI = donationConfig?.upiId;

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh", padding: "4rem 0" }}>
      <div className="container">
        
        {/* Donate Hero */}
        <div className="text-center" style={{ marginBottom: "4rem" }}>
          <span className="disease-badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>Support Us</span>
          <h1 style={{ marginTop: "0.5rem", fontSize: "3rem" }}>Support Free Healthcare Education</h1>
          <p className="text-muted" style={{ maxWidth: "600px", margin: "0.5rem auto 0", fontSize: "1.15rem" }}>
            Your contribution directly helps us maintain, write, and expand this educational platform, keeping verified medical guides free for everyone.
          </p>
        </div>

        {/* Layout Grid */}
        <div className="donate-layout">
          
          {/* Donation Form Card */}
          <div className="donate-form-card">
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              Make a Donation
            </h2>
            
            <form onSubmit={handlePaySubmit}>
              {/* Select Amount */}
              <div style={{ marginBottom: "2rem" }}>
                <label className="form-label">Select Amount (INR)</label>
                <div className="amount-grid">
                  {presets.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handleAmountPresetClick(amount)}
                      className={`amount-btn ${selectedAmount === amount ? "active" : ""}`}
                    >
                      ₹{amount}
                    </button>
                  ))}
                </div>

                <div className="custom-amount-input">
                  <span className="custom-amount-symbol">₹</span>
                  <input
                    type="number"
                    className="custom-amount-field"
                    placeholder="Enter custom amount"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}

                  />
                </div>
              </div>

              {/* Payment Method: UPI only */}
              <div className="payment-method-selector">
                <label className="form-label" style={{ marginBottom: "1rem" }}>Payment Method</label>
                <div className="payment-methods-grid">
                  <button
                    type="button"
                    className="payment-method-btn active"
                    style={{ cursor: "default" }}
                  >
                    <span className="payment-method-icon">📱</span>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontWeight: "600", fontSize: "0.95rem" }}>UPI / QR Code</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>GPay, PhonePe, Paytm</p>
                    </div>
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-accent btn-accent-glow btn-block" style={{ padding: "1rem" }}>
                Donate ₹{getFinalAmount()} Now
              </button>
            </form>
          </div>

          {/* Transparency Card */}
          <div className="transparency-card">
            <h3 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Where Your Funds Go</h3>
            <p className="text-muted" style={{ fontSize: "0.95rem" }}>
              We are committed to absolute financial transparency. 100% of public donations are used directly to power our education services:
            </p>
            <ul className="transparency-list">
              <li className="transparency-item">
                <span className="transparency-check">✓</span>
                <div>
                  <strong>Create Educational Content</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Compiling medical literature into peer-reviewed patient-friendly articles.</p>
                </div>
              </li>
              <li className="transparency-item">
                <span className="transparency-check">✓</span>
                <div>
                  <strong>Maintain Web Infrastructure</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Running fast, lightweight databases and secure hosting servers globally.</p>
                </div>
              </li>
              <li className="transparency-item">
                <span className="transparency-check">✓</span>
                <div>
                  <strong>Improve User Performance</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Optimizing visual features, search response, and mobile performance.</p>
                </div>
              </li>
              <li className="transparency-item">
                <span className="transparency-check">✓</span>
                <div>
                  <strong>Zero Advertisement Model</strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Keeping our site completely free from pharmaceutical banners or user tracking.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Simulated Payment Sheet Modal */}
      {showModal && (
        <div className="payment-modal-overlay">
          <div className="payment-modal">
            
            {/* Header */}
            <div className="payment-modal-header">
              <h3 style={{ fontSize: "1.1rem", margin: 0 }}>Secure Donation Checkout</h3>
              <button onClick={resetFlow} className="payment-close-btn" style={{ color: "var(--primary)" }}>×</button>
            </div>

            {/* Body */}
            <div className="payment-modal-body">
              {paymentStep === "pending" && (
                <div>
                  <p className="text-muted" style={{ fontSize: "0.95rem" }}>
                    You are donating <strong style={{ color: "var(--text-main)" }}>₹{getFinalAmount()}</strong> to HealthEdu Foundation.
                  </p>

                  <div className="upi-qr-wrapper">
                    {hasQRCode ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={donationConfig!.qrCodeBase64}
                        alt="Payment QR Code"
                        style={{ width: "100%", height: "100%", objectFit: "contain", background: "white", padding: "8px", borderRadius: "6px" }}
                      />
                    ) : (
                      <div style={{ border: "2px solid #000", padding: "10px", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase" }}>Scan &amp; Pay</span>
                        <span style={{ fontSize: "3.5rem" }}>📱</span>
                        <span style={{ fontSize: "0.6rem", wordBreak: "break-all", color: "var(--text-muted)" }}>
                          {hasUPI ? donationConfig!.upiId : "donate@healthedu"}
                        </span>
                      </div>
                    )}
                  </div>
                  {hasUPI && (
                    <p style={{ fontSize: "0.85rem", textAlign: "center", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      UPI ID: <strong style={{ color: "var(--text-main)" }}>{donationConfig!.upiId}</strong>
                    </p>
                  )}
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                    Scan the QR code with any UPI app (GPay, PhonePe, Paytm) then click the button below after completing payment.
                  </p>

                  <button onClick={startSimulatedPayment} className="btn btn-primary btn-block">
                    I Have Paid via UPI
                  </button>
                </div>
              )}

              {paymentStep === "processing" && (
                <div style={{ padding: "3rem 0" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" style={{ animation: "spin 1s linear infinite", marginBottom: "1.5rem" }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
                  </svg>
                  <h3>Verifying Payment...</h3>
                  <p className="text-muted" style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                    Verifying transaction authenticity and secure token routing. Please do not close this window.
                  </p>
                </div>
              )}

              {paymentStep === "success" && (
                <div style={{ padding: "2.5rem 0 1rem" }}>
                  <div className="payment-success-icon">🎉</div>
                  <h2 style={{ color: "var(--success)", fontSize: "1.75rem", marginBottom: "0.5rem" }}>Thank You!</h2>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "1rem" }}>Donation of ₹{getFinalAmount()} Successful</h3>
                  <p className="text-muted" style={{ fontSize: "0.95rem", padding: "0 1rem", marginBottom: "2rem" }}>
                    We have sent a simulated tax-deductible receipt to your session log. Your support is instrumental in keeping this educational tool completely free.
                  </p>
                  <button onClick={resetFlow} className="btn btn-secondary btn-block">
                    Close Window
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Bank Details Inline Block */
        .bank-details-inline {
          background: linear-gradient(135deg, rgba(0, 200, 150, 0.06) 0%, rgba(59, 130, 246, 0.06) 100%);
          border: 1px solid rgba(0, 200, 150, 0.2);
          border-radius: 14px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .bank-details-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.25rem;
        }

        .bank-details-header span {
          font-size: 1.4rem;
        }

        .bank-details-header h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-main);
          margin: 0;
        }

        .bank-details-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .bank-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.65rem 0.85rem;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          gap: 1rem;
        }

        .bank-detail-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .bank-detail-value {
          font-size: 0.9rem;
          color: var(--text-main);
          font-weight: 600;
          text-align: right;
        }

        .bank-detail-mono {
          font-family: monospace;
          font-size: 0.95rem;
          letter-spacing: 0.05em;
          color: #00c896;
        }

        .bank-ref-note {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: rgba(0, 200, 150, 0.06);
          border-radius: 8px;
          line-height: 1.5;
        }

        .bank-details-empty {
          text-align: center;
          color: var(--text-muted);
          font-style: italic;
          font-size: 0.9rem;
          padding: 1rem 0;
        }
      `}</style>
    </div>
  );
}
