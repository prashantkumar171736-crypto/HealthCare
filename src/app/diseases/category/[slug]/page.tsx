import { getDb } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  try {
    const db = await getDb();
    const category = await db.collection("categories").findOne({ slug });
    if (!category) {
      return {
        title: "Category Not Found | Rog Care Hindi",
      };
    }
    return {
      title: `${category.name} Articles & Resources | Rog Care Hindi`,
      description: category.description || `Read detailed medical guides and information about conditions in the ${category.name} category.`,
      alternates: {
        canonical: `/diseases/category/${slug}`,
      },
      openGraph: {
        title: `${category.name} Articles & Resources | Rog Care Hindi`,
        description: category.description || `Read detailed medical guides and information about conditions in the ${category.name} category.`,
        url: `https://rogcarehindi.vercel.app/diseases/category/${slug}`,
        siteName: "Rog Care Hindi",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${category.name} Articles & Resources | Rog Care Hindi`,
        description: category.description || `Read detailed medical guides and information about conditions in the ${category.name} category.`,
      },
    };
  } catch (error) {
    console.error("Error generating category metadata:", error);
    return {
      title: "Medical Category | Rog Care Hindi",
    };
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const categorySlug = resolvedParams.slug;

  let category = null;
  let diseases: any[] = [];

  try {
    const db = await getDb();
    
    // Find category info
    category = await db.collection("categories").findOne({ slug: categorySlug });
    
    if (!category) {
      notFound();
    }

    // Find all diseases belonging to this category
    diseases = await db.collection("diseases")
      .find({ categories: categorySlug })
      .project({ name: 1, slug: 1, overview: 1 })
      .sort({ name: 1 })
      .toArray();

  } catch (error) {
    console.error("Category Page Query Error:", error);
  }

  if (!category) {
    notFound();
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://rogcarehindi.vercel.app"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Diseases",
        "item": "https://rogcarehindi.vercel.app/diseases"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": category.name,
        "item": `https://rogcarehindi.vercel.app/diseases/category/${categorySlug}`
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div>
      {/* Category Header */}
      <section className="category-header">
        <div className="container">
          <Link
            href="/"
            className="text-muted"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem", fontSize: "0.95rem" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Categories
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "3rem", padding: "0.75rem", backgroundColor: "var(--primary-light)", borderRadius: "var(--radius-xl)" }}>
              {category.icon}
            </span>
            <div>
              <span className="disease-badge">Category Directory</span>
              <h1 style={{ marginTop: "0.25rem", marginBottom: 0 }}>{category.name}</h1>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: "1.15rem", maxWidth: "1450px", lineHeight: "1.6" }}>
            {category.description}
          </p>
        </div>
      </section>

      {/* Disease List */}
      <section className="category-disease-list">
        <div className="container">
          <h2 style={{ marginBottom: "2rem" }}>Diseases & Conditions</h2>
          
          {diseases.length === 0 ? (
            <div className="text-center" style={{ padding: "4rem", backgroundColor: "var(--surface)", borderRadius: "var(--radius-xl)" }}>
              <p className="text-muted">No articles available for this category yet.</p>
            </div>
          ) : (
            <div className="grid-3">
              {diseases.map((disease) => (
                <div key={disease.slug} className="disease-grid-card">
                  <div>
                    <h3 className="disease-grid-title">{disease.name}</h3>
                    <p className="disease-grid-desc">{disease.overview}</p>
                  </div>
                  <Link
                    href={`/diseases/${disease.slug}`}
                    className="btn btn-secondary btn-sm btn-block"
                    style={{ marginTop: "1rem" }}
                  >
                    Read Detailed Guide
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Quick FAQ / Educational Info block */}
      <section style={{ padding: "4rem 0", backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)" }}>
        <div className="container" style={{ maxWidth: "1450px" }}>
          <h2 className="text-center" style={{ marginBottom: "2.5rem" }}>Frequently Asked Questions</h2>
          
          <div className="disease-faq-item">
            <div className="disease-faq-question">
              When should I consult a doctor?
            </div>
            <div className="disease-faq-answer">
              If you or a loved one are experiencing symptoms listed in any of our guides that are persistent, worsening, or causing concern, you should consult a qualified physician immediately. Never ignore professional medical advice.
            </div>
          </div>

          <div className="disease-faq-item">
            <div className="disease-faq-question">
              Are these treatments suitable for everyone?
            </div>
            <div className="disease-faq-answer">
              No. Treatment choices depend heavily on individual diagnosis, health history, age, and other concurrent conditions. Our guides list general, FDA-approved, and standard clinical treatments for educational purposes only.
            </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
