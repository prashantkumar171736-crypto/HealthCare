"use client";

import { useState } from "react";

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(250);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("upi");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"pending" | "processing" | "success">("pending");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  const presets = [50, 100, 250, 500, 1000];

  const getFinalAmount = () => {
    if (selectedAmount !== null) {
      return selectedAmount;
    }
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
    setTimeout(() => {
      setPaymentStep("success");
    }, 2000); // 2s processing simulation
  };

  const resetFlow = () => {
    setShowModal(false);
    setPaymentStep("pending");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
  };

  const upiQrString = `upi://pay?pa=donate@healthedu&pn=HealthEdu%20Foundation&am=${getFinalAmount()}&cu=INR`;

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
                    min="10"
                  />
                </div>
              </div>

              {/* Payment Methods */}
              <div className="payment-method-selector">
                <label className="form-label" style={{ marginBottom: "1rem" }}>Choose Payment Method</label>
                <div className="payment-methods-grid">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("upi")}
                    className={`payment-method-btn ${paymentMethod === "upi" ? "active" : ""}`}
                  >
                    <span className="payment-method-icon">📱</span>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontWeight: "600", fontSize: "0.95rem" }}>UPI / QR Code</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>GPay, PhonePe, Paytm</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`payment-method-btn ${paymentMethod === "card" ? "active" : ""}`}
                  >
                    <span className="payment-method-icon">💳</span>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontWeight: "600", fontSize: "0.95rem" }}>Credit / Debit Card</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>Visa, MasterCard, Rupay</p>
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
                  
                  {paymentMethod === "upi" ? (
                    <div>
                      <div className="upi-qr-wrapper">
                        {/* A clean mock QR Code block */}
                        <div style={{ border: "2px solid #000", padding: "10px", width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase" }}>Scan & Pay</span>
                          <span style={{ fontSize: "3.5rem" }}>📱</span>
                          <span style={{ fontSize: "0.6rem", wordBreak: "break-all", color: "var(--text-muted)" }}>donate@healthedu</span>
                        </div>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                        Scan this mock QR code with any UPI app (GPay, PhonePe, Paytm) or click the button below to simulate payment authorization.
                      </p>
                    </div>
                  ) : (
                    <div style={{ margin: "1.5rem 0", textAlign: "left" }}>
                      <div className="form-group">
                        <label className="form-label">Cardholder Name</label>
                        <input type="text" className="form-control" placeholder="John Doe" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Card Number</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="4111 2222 3333 4444"
                          maxLength={19}
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid-2" style={{ gap: "1rem" }}>
                        <div className="form-group">
                          <label className="form-label">Expiry Date</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="MM/YY"
                            maxLength={5}
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">CVV</label>
                          <input
                            type="password"
                            className="form-control"
                            placeholder="123"
                            maxLength={3}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button onClick={startSimulatedPayment} className="btn btn-primary btn-block">
                    Authorize Simulated Payment
                  </button>
                </div>
              )}

              {paymentStep === "processing" && (
                <div style={{ padding: "3rem 0" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" style={{ animation: "spin 1s linear infinite", marginBottom: "1.5rem" }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
                  </svg>
                  <h3>Contacting Bank Server...</h3>
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
      `}</style>
    </div>
  );
}
