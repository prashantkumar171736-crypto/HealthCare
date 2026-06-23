export const metadata = {
  title: "Terms & Conditions | HealthEdu",
  description: "Read the Terms & Conditions of using the HealthEdu website and accessing our medical articles.",
};

export default function TermsPage() {
  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh", padding: "4rem 0" }}>
      <div className="container text-page-content" style={{ backgroundColor: "var(--surface)", padding: "3rem", borderRadius: "var(--radius-2xl)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <span className="disease-badge">Legal</span>
        <h1>Terms & Conditions</h1>
        <p className="text-light" style={{ fontSize: "0.85rem", marginBottom: "2rem" }}>Last Updated: June 17, 2026</p>

        <p>
          Welcome to HealthEdu. By accessing or using this website, you agree to comply with and be bound by the following Terms and Conditions of use.
        </p>

        <h2>1. Educational Purpose Only</h2>
        <p>
          All information on this website is provided for general educational and informational purposes only. It is not intended to be clinical guidance. Under no circumstances should you use our articles to diagnose, treat, or prevent any illness. If you are experiencing a medical emergency, call emergency services immediately.
        </p>

        <h2>2. Use of Content</h2>
        <p>
          You may print and share our disease articles, symptoms guides, and medical tests pages for personal, non-commercial, or classroom educational use. You may not scrape, re-publish, or sell our content in bulk without explicit written permission.
        </p>

        <h2>3. Donation Terms</h2>
        <p>
          All donations to HealthEdu are voluntary contributions to support website operations and article compilation. Donations are non-refundable. We simulate payment processing for demonstration purposes in our checkout sandbox to showcase premium checkout flows.
        </p>

        <h2>4. Limitation of Liability</h2>
        <p>
          HealthEdu does not guarantee that the content is completely free of typographical errors or omissions. We do not assume liability for any harm or injury arising from the use or misuse of the information found on this platform.
        </p>
      </div>
    </div>
  );
}
