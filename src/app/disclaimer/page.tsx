export const metadata = {
  title: "Medical Disclaimer | HealthEdu",
  description: "Read our official Medical Disclaimer outlining the limits of HealthEdu's educational resources.",
};

export default function DisclaimerPage() {
  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh", padding: "4rem 0" }}>
      <div className="container text-page-content" style={{ backgroundColor: "var(--surface)", padding: "3rem", borderRadius: "var(--radius-2xl)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <span className="disease-badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>Critical Notice</span>
        <h1 style={{ color: "var(--accent-hover)" }}>Medical Disclaimer</h1>
        <p className="text-light" style={{ fontSize: "0.85rem", marginBottom: "2rem" }}>Last Updated: June 17, 2026</p>

        <div style={{ backgroundColor: "var(--accent-light)", borderLeft: "5px solid var(--accent)", padding: "1.5rem", borderRadius: "var(--radius-lg)", marginBottom: "2rem" }}>
          <p style={{ color: "var(--accent-hover)", fontWeight: "700", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            IMPORTANT NOTICE: READ CAREFULLY
          </p>
          <p style={{ margin: 0, color: "var(--text-main)", fontSize: "0.95rem" }}>
            The resources and content provided on this website are for educational and informational purposes only. This website does not offer medical diagnoses, treatments, or clinical consultations.
          </p>
        </div>

        <h2>1. No Medical Advice</h2>
        <p>
          The text, graphics, images, and other materials on HealthEdu are designed solely to help users understand common diseases, medical tests, and symptoms. None of the content should be considered professional clinical advice or a prescription of treatments.
        </p>

        <h2>2. Seek Professional Medical Advice</h2>
        <p>
          Always seek the advice of your personal physician, specialist, or other licensed healthcare provider regarding any questions you have about a medical condition. Do not delay seeking medical care, and do not disregard medical advice you have received because of something you read on this website.
        </p>

        <h2>3. No Doctor-Patient Relationship</h2>
        <p>
          Your use of this website, its search functions, its library guides, or any interactive features does not create a doctor-patient relationship between you and HealthEdu, its writers, its editors, or its developers.
        </p>

        <h2>4. Accuracy & Updates</h2>
        <p>
          While we strive to ensure our guides are compiled from peer-reviewed medical guidelines, we make no guarantees about the completeness, timeliness, or absolute clinical accuracy of the articles. Clinical guidelines change frequently as medical research progresses.
        </p>
      </div>
    </div>
  );
}
