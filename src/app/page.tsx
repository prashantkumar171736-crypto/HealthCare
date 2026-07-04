import { getDb } from "@/lib/db";
import SearchBar from "@/components/SearchBar";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 3600; // Cache page for 1 hour

export const metadata: Metadata = {
  title: "Rog Care Hindi | Your Trusted Health Education Resource",
  description: "Learn about diseases, symptoms, causes, diagnoses, prevention strategies, and healthy living in Hindi and English. Access verified medical guides.",
  alternates: {
    canonical: "/",
  },
};

export default async function Home() {
  let categories = [];
  let stats = { categoriesCount: 15, diseasesCount: 105, libraryCount: 7 };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Rog Care Hindi",
    "url": "https://rogcarehindi.vercel.app",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://rogcarehindi.vercel.app/diseases?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Rog Care Hindi",
    "url": "https://rogcarehindi.vercel.app",
    "logo": "https://rogcarehindi.vercel.app/logo.png"
  };

  try {
    const db = await getDb();
    categories = await db.collection("categories").find({}).toArray();
    stats.categoriesCount = categories.length;
    stats.diseasesCount = await db.collection("diseases").countDocuments({});
    stats.libraryCount = await db.collection("library").countDocuments({});
  } catch (error) {
    console.error("Home Page DB Query Error:", error);
    // Fallback static categories list in case database is connection-throttled
    categories = [
      { slug: "cancer", name: "Cancer", icon: "🩺", description: "Learn about different types of cancer, their causes, stages, treatments, and prevention." },
      { slug: "heart-diseases", name: "Heart Diseases", icon: "❤️", description: "Information on cardiovascular conditions, heart attacks, prevention, and lifestyle." },
      { slug: "diabetes", name: "Diabetes", icon: "🍬", description: "Understanding Type 1, Type 2, and Gestational diabetes, management, and glucose tracking." },
      { slug: "respiratory-diseases", name: "Respiratory Diseases", icon: "🫁", description: "Insights into conditions affecting the lungs and airways, from asthma to COPD." }
    ];
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <div>
        {/* 1. Hero Section */}
      <section className="hero">
        <div className="container">
          <h1 className="hero-title">Your Trusted Health Education Resource</h1>
          <p className="hero-subtitle">
            Learn about diseases, symptoms, treatments, prevention, and healthy living from peer-reviewed medical information.
          </p>
          <div className="hero-actions">
            <Link href="/diseases" className="btn btn-primary">
              Explore Diseases
            </Link>
            <Link href="/donate" className="btn btn-accent btn-accent-glow">
              Donate ❤️
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Search Section */}
      <section style={{ padding: "1rem 0 3rem" }}>
        <div className="container text-center">
          <h2 style={{ fontSize: "1.75rem", marginBottom: "1.5rem" }}>Search Any Disease</h2>
          <SearchBar />
        </div>
      </section>

      {/* 3. Disease Categories Grid */}
      <section className="categories-section" style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <h2 className="section-title">Disease Categories</h2>
          <p className="section-subtitle">
            Browse our comprehensive collection of health guides and resources categorized by medical areas.
          </p>

          <div className="grid-3">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/diseases/category/${category.slug}`}
                className="category-card"
              >
                <div className="category-icon-wrapper">
                  {category.icon}
                </div>
                <h3 className="category-title">{category.name}</h3>
                <p className="category-desc">{category.description}</p>
                <span className="category-link">
                  View Diseases
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Stats Section */}
      <section className="stats-section">
        <div className="container stats-grid">
          <div className="stat-item">
            <span className="stat-number">{stats.categoriesCount}+</span>
            <span className="stat-label">Medical Categories</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.diseasesCount}+</span>
            <span className="stat-label">Disease Articles</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.libraryCount}+</span>
            <span className="stat-label">Library Guides</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">100%</span>
            <span className="stat-label">Free & Accessible</span>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
