"use client";

import { useState } from "react";

interface FAQ {
  q: string;
  a: string;
}

export default function FAQClient({ faqs }: { faqs: FAQ[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
