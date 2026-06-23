"use client";

import { useState } from "react";

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Is the information on HealthEdu really free?",
      a: "Yes. All articles, symptom guides, and directory resources are 100% free to access. We do not place content behind a paywall, nor do we sell ads or user data."
    },
    {
      q: "Where does the medical information come from?",
      a: "Our educational content is compiled directly from peer-reviewed, authoritative medical institutions such as the World Health Organization (WHO), Mayo Clinic, CDC, and National Institutes of Health (NIH). We translate complex clinical language into understandable formats for general readers."
    },
    {
      q: "How does the optional donation system work?",
      a: "Because we refuse to host distracting advertisements, we rely on donations from readers like you to support web server fees, content production, and site speed optimization. You can donate using UPI, Google Pay, PhonePe, Paytm, or Credit/Debit Cards on our Donate page."
    },
    {
      q: "Can I use this site instead of seeing a doctor?",
      a: "No. The information on this website is for educational purposes only. It is not a substitute for professional medical diagnosis, advice, or treatment. Always consult a physician for any physical or mental health concerns."
    },
    {
      q: "How can I contribute to or suggest new disease pages?",
      a: "We welcome suggestions! If you notice a disease or condition is missing from our directory, feel free to email our medical compiling team at suggestions@healthedu.org."
    },
    {
      q: "Are the donations tax-deductible?",
      a: "HealthEdu is registered as a non-profit educational platform. Depending on your jurisdiction, your donation may be tax-deductible. We provide simulated email receipts upon checkout to verify transactions."
    }
  ];

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh", padding: "4rem 0" }}>
      <div className="container">
        
        <div className="text-center" style={{ marginBottom: "3rem" }}>
          <span className="disease-badge">Got Questions?</span>
          <h1 style={{ marginTop: "0.5rem" }}>Frequently Asked Questions</h1>
          <p className="text-muted" style={{ maxWidth: "600px", margin: "0.5rem auto 0" }}>
            Learn more about how our platform operates, where we source our articles, and how our support model works.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="faq-item">
                <div 
                  className="faq-question" 
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  style={{
                    backgroundColor: isOpen ? "var(--primary-light)" : "",
                    color: isOpen ? "var(--primary)" : ""
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ fontSize: "1.25rem" }}>{isOpen ? "−" : "+"}</span>
                </div>
                {isOpen && (
                  <div className="faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
