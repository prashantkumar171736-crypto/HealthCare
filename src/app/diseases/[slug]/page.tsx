import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import DiseaseDetailClient from "./DiseaseDetailClient";
import Link from "next/link";

export const revalidate = 3600; // Cache articles for 1 hour

interface PageProps {
  params: Promise<{ slug: string }>;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  try {
    const db = await getDb();
    let disease = await db.collection("diseases").findOne({ slug });
    
    if (!disease) {
      // Check if it's a post
      const post = await db.collection("posts").findOne({ 
        $or: [
          { slug },
          { title: { $regex: new RegExp(`^${slug.replace(/-/g, " ")}$`, "i") } }
        ]
      });
      if (post) {
        return {
          title: `${post.title} | HealthEdu`,
          description: stripHtml(post.content).substring(0, 155) + "...",
        };
      }
      return {
        title: "Article Not Found | HealthEdu",
        description: "The requested healthcare article was not found.",
      };
    }

    return {
      title: `${disease.name} - Symptoms, Causes, Treatment & Prevention | HealthEdu`,
      description: disease.overview ? disease.overview.substring(0, 155) + "..." : `Learn about ${disease.name} clinical symptoms, risk factors, and treatments.`,
    };
  } catch (error) {
    console.error("Metadata Generation Error:", error);
    return {
      title: "Disease Details | HealthEdu",
    };
  }
}

export default async function DiseaseDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  let disease = null;
  let post = null;
  let isPost = false;
  let categoryNames: Record<string, string> = {};
  let relatedDiseasesData: { name: string; slug: string }[] = [];

  try {
    const db = await getDb();
    
    // Fetch the disease
    disease = await db.collection("diseases").findOne({ slug });
    
    if (!disease) {
      // Check if it's a post
      post = await db.collection("posts").findOne({ 
        $or: [
          { slug },
          { title: { $regex: new RegExp(`^${slug.replace(/-/g, " ")}$`, "i") } }
        ]
      });
      if (!post) {
        notFound();
      }
      isPost = true;
    }

    // Fetch categories to resolve display names
    const categories = await db.collection("categories").find({}).project({ slug: 1, name: 1 }).toArray();
    categoryNames = categories.reduce((acc, cat) => {
      acc[cat.slug] = cat.name;
      return acc;
    }, {} as Record<string, string>);

    if (!isPost && disease && disease.relatedDiseases && disease.relatedDiseases.length > 0) {
      // Fetch related diseases
      relatedDiseasesData = await db.collection("diseases")
        .find({ slug: { $in: disease.relatedDiseases } })
        .project({ name: 1, slug: 1 })
        .toArray() as any;
    }

  } catch (error) {
    console.error("Disease Page Query Error:", error);
  }

  if (isPost && post) {
    const formattedDate = new Date(post.createdAt || post.updatedAt || new Date()).toLocaleDateString("en-US", {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return (
      <div className="container" style={{ padding: "3rem 1.5rem", minHeight: "80vh" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: "2rem" }}>
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

        {/* Post Container */}
        <article className="post-detail-container" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <header style={{ marginBottom: "2rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.5rem" }}>
            <span
              className="tag"
              style={{
                fontSize: "0.8rem",
                padding: "0.25rem 0.6rem",
                backgroundColor: "var(--primary-light)",
                color: "var(--primary)",
                borderRadius: "var(--radius-full)",
                fontWeight: "600",
                display: "inline-block",
                marginBottom: "1rem"
              }}
            >
              Medical Guide
            </span>
            <h1 style={{ fontSize: "2.75rem", fontWeight: "800", marginBottom: "1rem", lineHeight: "1.2", color: "var(--text-main)" }}>
              {post.title}
            </h1>
            <div style={{ display: "flex", gap: "1rem", color: "var(--text-light)", fontSize: "0.9rem" }}>
              <span>Published: <strong>{formattedDate}</strong></span>
              <span>•</span>
              <span>Category: <strong>Section {post.category || "General"}</strong></span>
            </div>
          </header>

          {/* Documentation HTML Content */}
          <div 
            className="post-documentation-view" 
            dangerouslySetInnerHTML={{ __html: post.content }}
            style={{
              fontSize: "1.1rem",
              lineHeight: "1.8",
              color: "var(--text-main)",
            }}
          />
        </article>
      </div>
    );
  }

  if (!disease) {
    notFound();
  }

  // Map database _id to string for component serialization
  const serializedDisease = {
    ...disease,
    _id: disease._id.toString(),
  } as any;

  return (
    <div>
      {/* Disease Header Banner */}
      <section className="disease-page-header">
        <div className="container">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
            {serializedDisease.categories.map((catSlug: string) => (
              <Link key={catSlug} href={`/diseases/category/${catSlug}`} className="disease-badge">
                {categoryNames[catSlug] || catSlug}
              </Link>
            ))}
          </div>
          <h1 style={{ fontSize: "2.75rem", marginBottom: "0.5rem" }}>{serializedDisease.name}</h1>
          <p className="text-muted" style={{ fontSize: "1.1rem", maxWidth: "800px" }}>
            Comprehensive guide covering clinical description, symptoms, risk factors, diagnosis, treatment, and prevention.
          </p>
        </div>
      </section>

      {/* Disease Layout Content */}
      <section style={{ backgroundColor: "var(--background)" }}>
        <DiseaseDetailClient
          disease={serializedDisease}
          categoryNames={categoryNames}
          relatedDiseasesData={relatedDiseasesData}
        />
      </section>
    </div>
  );
}
