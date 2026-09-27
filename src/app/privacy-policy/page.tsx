import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Rog Care Hindi",
  description: "Learn how Rog Care Hindi protects your privacy and maintains a zero-advertising and non-tracking policy.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ backgroundColor: "transparent", minHeight: "80vh", padding: "4rem 0" }}>
      <div className="container text-page-content" style={{ backgroundColor: "rgba(7, 24, 35, 0.78)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "3rem", borderRadius: "var(--radius-2xl)", border: "1px solid rgba(0, 229, 255, 0.18)", boxShadow: "var(--shadow-lg)" }}>
        <span className="disease-badge">Legal</span>
        <h1>Privacy Policy</h1>
        <p className="text-light" style={{ fontSize: "0.85rem", marginBottom: "2rem" }}>Last Updated: June 17, 2026</p>

        <p>
          At HealthEdu, we take your privacy extremely seriously. Because our mission is to provide trusted, independent health education, we have built our platform with a privacy-first architecture.
        </p>

        <h2>1. Zero Advertisement Policy</h2>
        <p>
          We do not partner with third-party advertising networks. We do not host ad banners, cookie-tracking remarketing pixels, or sponsored links. This guarantees that your reading habits and medical queries on our site are never tracked, packaged, or sold to pharmaceutical companies or marketing brokers.
        </p>

        <h2>2. Information We Collect</h2>
        <p>
          We collect the absolute minimum data necessary to serve our users:
        </p>
        <ul>
          <li><strong>Search Queries:</strong> Queries typed into our search bar are processed to return results. We do not link these searches to individual IP addresses or user accounts.</li>
          <li><strong>Donation Details:</strong> If you choose to donate, we collect information needed to process payments (amount, name, email). Financial details are processed securely and we do not store credit card numbers on our servers.</li>
        </ul>

        <h2>3. Use of Cookies</h2>
        <p>
          We only use essential functional cookies to optimize site performance, preserve font sizes, and manage donation form checkout states. We do not use profiling or behavioral tracking cookies.
        </p>

        <h2>4. Contact Us</h2>
        <p>
          If you have any questions or concerns regarding our privacy standards, please email our security officer at privacy@healthedu.org.
        </p>
      </div>
    </div>
  );
}
