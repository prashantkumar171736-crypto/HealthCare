"use client";

import { useState } from "react";
import Link from "next/link";

interface FAQItem {
  q: string;
  a: string;
}

interface DiseaseData {
  name: string;
  slug: string;
  categories: string[];
  overview: string;
  symptoms: string | string[];
  causes: string | string[];
  riskFactors: string | string[];
  diagnosis: string;
  treatmentOptions: string | string[];
  prevention: string;
  faq: FAQItem[];
  references: string[];
  relatedDiseases: string[];
}

export default function DiseaseDetailClient({
  disease,
  categoryNames,
  relatedDiseasesData,
}: {
  disease: DiseaseData;
  categoryNames: Record<string, string>;
  relatedDiseasesData: { name: string; slug: string }[];
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const tabs = [
    { id: "overview", label: "Overview", icon: "📖" },
    { id: "symptoms", label: "Symptoms", icon: "🤒" },
    { id: "causes", label: "Causes & Risks", icon: "🧬" },
    { id: "diagnosis", label: "Diagnosis & Tests", icon: "🔍" },
    { id: "treatments", label: "Treatments", icon: "💊" },
    { id: "prevention", label: "Prevention", icon: "🛡️" },
    { id: "faq", label: "FAQs", icon: "❓" },
  ];

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Learn about ${disease.name} symptoms, causes, and treatments on HealthEdu:`;

  const handleShare = (platform: string) => {
    let url = "";
    switch (platform) {
      case "fb":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case "wa":
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
        break;
      case "li":
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case "tw":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
    }
    if (url) window.open(url, "_blank", "width=600,height=400");
  };

  return (
    <div className="container">
      {/* Breadcrumb & Navigation */}
      <div style={{ padding: "1.5rem 0 0" }}>
        <Link
          href="/diseases"
          className="text-muted"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Directory
        </Link>
      </div>

      <div className="disease-layout">
        {/* Sidebar Nav (Desktop) */}
        <aside className="disease-sidebar">
          <nav className="disease-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`disease-nav-item ${activeTab === tab.id ? "active" : ""}`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Panel */}
        <article className="disease-content">
          {/* Overview Section */}
          <section className={`disease-section ${activeTab === "overview" ? "active" : ""}`}>
            <h2>Overview & Description</h2>
            <div
              className="doc-content"
              dangerouslySetInnerHTML={{ __html: disease.overview }}
            />
            <h3>Key Details</h3>
            <p>
              This educational guide contains clinical insights regarding <strong>{disease.name}</strong>. Use the tabs in the sidebar (or top menu on mobile) to navigate through symptoms, causes, diagnostics, treatment choices, and prevention strategies.
            </p>
          </section>

          {/* Symptoms Section */}
          <section className={`disease-section ${activeTab === "symptoms" ? "active" : ""}`}>
            <h2>Common Symptoms</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Symptoms of {disease.name} can range from mild to severe, and they may vary significantly from person to person. Common symptoms include:
            </p>
            {typeof disease.symptoms === "string" ? (
              <div className="doc-content" dangerouslySetInnerHTML={{ __html: disease.symptoms }} />
            ) : (
              <ul className="disease-list">
                {disease.symptoms.map((symptom, idx) => (
                  <li key={idx}>✨ {symptom}</li>
                ))}
              </ul>
            )}
            <div style={{ backgroundColor: "var(--accent-light)", padding: "1.25rem", borderRadius: "var(--radius-lg)", borderLeft: "4px solid var(--accent)", marginTop: "2rem" }}>
              <p style={{ color: "var(--accent-hover)", fontWeight: "600", marginBottom: "0.5rem" }}>⚠️ When to see a doctor:</p>
              <p style={{ fontSize: "0.95rem", margin: 0, color: "var(--text-main)" }}>
                If you experience any warning symptoms or if they persist and worsen over time, consult a medical professional immediately.
              </p>
            </div>
          </section>

          {/* Causes Section */}
          <section className={`disease-section ${activeTab === "causes" ? "active" : ""}`}>
            <h2>Causes & Development</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Understanding what causes {disease.name} is key to both treatment and prevention. The primary causes include:
            </p>
            {typeof disease.causes === "string" ? (
              <div className="doc-content" dangerouslySetInnerHTML={{ __html: disease.causes }} />
            ) : (
              <ul className="disease-list">
                {disease.causes.map((cause, idx) => (
                  <li key={idx}>⚙️ {cause}</li>
                ))}
              </ul>
            )}

            <h3 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Risk Factors</h3>
            <p style={{ marginBottom: "1.5rem" }}>
              Certain factors can increase your likelihood of developing {disease.name}. These include:
            </p>
            {typeof disease.riskFactors === "string" ? (
              <div className="doc-content" dangerouslySetInnerHTML={{ __html: disease.riskFactors }} />
            ) : (
              <ul className="disease-list">
                {disease.riskFactors.map((risk, idx) => (
                  <li key={idx}>⚡ {risk}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Diagnosis Section */}
          <section className={`disease-section ${activeTab === "diagnosis" ? "active" : ""}`}>
            <h2>Diagnosis & Medical Tests</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              Getting an accurate diagnosis is the first step in managing {disease.name}. Doctors utilize a combination of clinical assessments and diagnostic testing:
            </p>
            <div
              className="doc-content"
              style={{ padding: "1.25rem", backgroundColor: "var(--background)", borderRadius: "var(--radius-lg)", borderLeft: "4px solid var(--primary)" }}
              dangerouslySetInnerHTML={{ __html: disease.diagnosis }}
            />
          </section>

          {/* Treatments Section */}
          <section className={`disease-section ${activeTab === "treatments" ? "active" : ""}`}>
            <h2>Treatment Options</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              While some conditions can be cured, others are managed to control symptoms and improve quality of life. Standard treatment protocols for {disease.name} include:
            </p>
            {typeof disease.treatmentOptions === "string" ? (
              <div className="doc-content" dangerouslySetInnerHTML={{ __html: disease.treatmentOptions }} />
            ) : (
              <ul className="disease-list">
                {disease.treatmentOptions.map((treatment, idx) => (
                  <li key={idx}>✔️ {treatment}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Prevention Section */}
          <section className={`disease-section ${activeTab === "prevention" ? "active" : ""}`}>
            <h2>Prevention Guide</h2>
            <p style={{ marginBottom: "1.5rem" }}>
              In many instances, adopting key healthy habits and reducing exposure to risk factors can prevent or delay the onset of {disease.name}:
            </p>
            <div
              className="doc-content"
              style={{ padding: "1.25rem", backgroundColor: "var(--primary-light)", borderRadius: "var(--radius-lg)", color: "var(--text-main)" }}
              dangerouslySetInnerHTML={{ __html: disease.prevention }}
            />
          </section>

          {/* FAQ Section */}
          <section className={`disease-section ${activeTab === "faq" ? "active" : ""}`}>
            <h2>Frequently Asked Questions</h2>
            {disease.faq && disease.faq.length > 0 ? (
              <div style={{ marginTop: "1.5rem" }}>
                {disease.faq.map((item, idx) => (
                  <div key={idx} className="disease-faq-item">
                    <div
                      className="disease-faq-question"
                      onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    >
                      <span>❓ {item.q}</span>
                      <span>{openFaqIndex === idx ? "−" : "+"}</span>
                    </div>
                    {openFaqIndex === idx && (
                      <div className="disease-faq-answer">{item.a}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No FAQs available for this condition.</p>
            )}
          </section>

          {/* References Footer */}
          <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)" }}>
            <h4 style={{ fontSize: "1rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Sources and References:</h4>
            <ul style={{ paddingLeft: "1.25rem", fontSize: "0.85rem", color: "var(--text-light)" }}>
              {disease.references &&
                disease.references.map((ref, idx) => <li key={idx}>{ref}</li>)}
            </ul>
          </div>

          {/* Social Share Block */}
          <div className="share-block">
            <span style={{ fontWeight: "700", color: "var(--text-muted)" }}>Share Article:</span>
            <div className="share-buttons">
              <button onClick={() => handleShare("fb")} className="share-btn share-fb" aria-label="Share on Facebook">f</button>
              <button onClick={() => handleShare("wa")} className="share-btn share-wa" aria-label="Share on WhatsApp">W</button>
              <button onClick={() => handleShare("li")} className="share-btn share-li" aria-label="Share on LinkedIn">in</button>
              <button onClick={() => handleShare("tw")} className="share-btn share-tw" aria-label="Share on Twitter">X</button>
            </div>
          </div>
        </article>
      </div>

      {/* Related Diseases Widget */}
      {relatedDiseasesData.length > 0 && (
        <div className="related-diseases-widget">
          <h3 className="related-diseases-title">Related Diseases & Conditions</h3>
          <div className="related-links-grid">
            {relatedDiseasesData.map((rel) => (
              <Link key={rel.slug} href={`/diseases/${rel.slug}`} className="related-link-card">
                {rel.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
