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

        {/* Global style overrides for rich-text documentation content inside post-documentation-view */}
        <style jsx global>{`
          .post-documentation-view {
            word-break: break-word;
          }
          .post-documentation-view h1 {
            font-size: 2rem; font-weight: 800; color: var(--text-main);
            border-bottom: 2px solid var(--primary-light);
            padding-bottom: 0.5rem; margin: 2rem 0 1rem;
          }
          .post-documentation-view h2 {
            font-size: 1.6rem; font-weight: 700; color: var(--text-main);
            margin: 1.75rem 0 1rem;
          }
          .post-documentation-view h3 {
            font-size: 1.3rem; font-weight: 700; color: var(--text-main);
            margin: 1.5rem 0 0.75rem;
          }
          .post-documentation-view blockquote {
            border-left: 4px solid var(--primary);
            padding: 0.5rem 1rem;
            margin: 1.5rem 0;
            color: var(--text-muted);
            background: var(--primary-light);
            border-radius: 0 8px 8px 0;
            font-style: italic;
          }
          .post-documentation-view table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5rem 0;
          }
          .post-documentation-view th, .post-documentation-view td {
            border: 1px solid var(--border);
            padding: 10px 14px;
          }
          .post-documentation-view th {
            background: var(--primary-light);
            color: var(--primary);
            font-weight: 700;
          }
          .post-documentation-view img {
            max-width: 100%;
            border-radius: 8px;
            margin: 1rem 0;
            display: block;
          }
          .post-documentation-view a {
            color: var(--primary);
            text-decoration: underline;
          }
          .post-documentation-view code {
            background: var(--border);
            padding: 0.15rem 0.4rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9rem;
            color: var(--accent-hover);
          }
          .post-documentation-view pre {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1rem;
            overflow-x: auto;
            margin: 1.5rem 0;
          }
          .post-documentation-view ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
          .post-documentation-view ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
          .post-documentation-view li { margin: 0.4rem 0; }
          .post-documentation-view hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 2rem 0;
          }
        `}</style>
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
