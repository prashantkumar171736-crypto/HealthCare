import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | Rog Care Hindi — Free Healthcare Education",
  description:
    "Learn about the mission, values, and editorial standards behind Rog Care Hindi. Free peer-reviewed healthcare education in Hindi and English for everyone in India.",
  keywords: [
    "about Rog Care Hindi", "healthcare mission", "medical education India",
    "free health information", "WHO NIH medical guides", "rogcarehindi about",
    "रोग केयर हिंदी के बारे में", "स्वास्थ्य शिक्षा", "मुफ्त स्वास्थ्य जानकारी",
  ],
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Us | Rog Care Hindi — Free Healthcare Education",
    description:
      "Learn about the mission, values, and editorial standards behind Rog Care Hindi. Free peer-reviewed healthcare education in Hindi and English.",
    url: "https://rogcarehindi.vercel.app/about",
    siteName: "Rog Care Hindi",
    type: "website",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "About Rog Care Hindi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Us | Rog Care Hindi — Free Healthcare Education",
    description: "Our mission: free, peer-reviewed medical education in Hindi & English for everyone.",
    images: ["/logo.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Rog Care Hindi",
  "url": "https://rogcarehindi.vercel.app",
  "logo": { "@type": "ImageObject", "url": "https://rogcarehindi.vercel.app/logo.png" },
  "description": "Free peer-reviewed healthcare education in Hindi and English. Covering diseases, symptoms, treatments, and prevention strategies.",
  "foundingDate": "2024",
  "areaServed": "IN",
  "inLanguage": ["en", "hi"],
  "knowsAbout": ["Healthcare", "Medical Education", "Disease Prevention", "Health Tips"],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rogcarehindi.vercel.app" },
    { "@type": "ListItem", "position": 2, "name": "About", "item": "https://rogcarehindi.vercel.app/about" },
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ backgroundColor: "var(--background)", minHeight: "80vh", padding: "4rem 0" }}>
      <div className="container text-page-content" style={{ backgroundColor: "var(--surface)", padding: "3rem", borderRadius: "var(--radius-2xl)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        
        <span className="disease-badge" style={{ marginBottom: "1rem" }}>Our Mission</span>
        <h1 style={{ marginBottom: "1.5rem" }}>About HealthEdu</h1>
        
        <p style={{ fontSize: "1.15rem", color: "var(--text-main)", lineHeight: "1.7", marginBottom: "2rem" }}>
          HealthEdu was founded with a singular, powerful vision: to make high-quality, clinical-grade healthcare education completely free, accessible, and understandable for every person in the world.
        </p>

        <h2>Democratizing Medical Information</h2>
        <p>
          We believe that health literacy is a fundamental human right. When individuals understand diseases, recognize symptoms early, know their diagnostic options, and learn about healthy lifestyle preventions, they are empowered to make better decisions for themselves and their families.
        </p>
        <p>
          Our platform aims to translate complex medical literature, clinical guidelines, and anatomical reviews into clear, actionable guides. We cover everything from common ailments like asthma and eczema to complex conditions like lung cancer and rare genetic disorders.
        </p>

        <h2 style={{ marginTop: "2.5rem" }}>Our Editorial Standards</h2>
        <p>
          Accuracy is our highest priority. All content published on HealthEdu follows a strict creation and validation process:
        </p>
        <ul>
          <li><strong>Peer-Reviewed Sources:</strong> Our guides are compiled from recognized medical authorities including the World Health Organization (WHO), National Institutes of Health (NIH), and major clinical research organizations.</li>
          <li><strong>Regular Updates:</strong> Medicine is an evolving science. We update our articles regularly to incorporate new treatment methodologies, diagnostic criteria, and immunization guidelines.</li>
          <li><strong>No Commercial Influence:</strong> We do not host pharmaceutical advertisements, nor are we funded by corporate medical sponsors. This ensures our educational articles remain entirely objective and unbiased.</li>
        </ul>

        <h2 style={{ marginTop: "2.5rem" }}>Community Supported Model</h2>
        <p>
          To maintain our independence and keep our content free of banners and trackers, HealthEdu runs on an optional, community-supported donation model. 
        </p>
        <p>
          Every donation received through our platform helps cover web database hosting, research compiling, and site optimizations. If you find our resources valuable, please consider supporting us.
        </p>
      </div>
      </div>
    </>
  );
}

