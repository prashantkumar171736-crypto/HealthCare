import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import DiseaseDetailClient from "./DiseaseDetailClient";
import Link from "next/link";

export const revalidate = 3600; // Cache articles for 1 hour

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  try {
    const db = await getDb();
    const disease = await db.collection("diseases").findOne({ slug });
    
    if (!disease) {
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
  let categoryNames: Record<string, string> = {};
  let relatedDiseasesData: { name: string; slug: string }[] = [];

  try {
    const db = await getDb();
    
    // Fetch the disease
    disease = await db.collection("diseases").findOne({ slug });
    
    if (!disease) {
      notFound();
    }

    // Fetch categories to resolve display names
    const categories = await db.collection("categories").find({}).project({ slug: 1, name: 1 }).toArray();
    categoryNames = categories.reduce((acc, cat) => {
      acc[cat.slug] = cat.name;
      return acc;
    }, {} as Record<string, string>);

    // Fetch related diseases
    if (disease.relatedDiseases && disease.relatedDiseases.length > 0) {
      relatedDiseasesData = await db.collection("diseases")
        .find({ slug: { $in: disease.relatedDiseases } })
        .project({ name: 1, slug: 1 })
        .toArray() as any;
    }

  } catch (error) {
    console.error("Disease Page Query Error:", error);
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
