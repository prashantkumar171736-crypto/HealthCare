import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import HealthLibraryClient from "./HealthLibraryClient";

export const revalidate = 3600; // Cache library page for 1 hour

export const metadata: Metadata = {
  title: "Health Library - Symptoms, Tests & Treatments Guides | Rog Care Hindi",
  description: "Access our educational resource guides explaining clinical tests, symptoms analysis checklists, and treatment procedures.",
  alternates: {
    canonical: "/health-library",
  },
  openGraph: {
    title: "Health Library - Symptoms, Tests & Treatments Guides | Rog Care Hindi",
    description: "Access our educational resource guides explaining clinical tests, symptoms analysis checklists, and treatment procedures.",
    url: "https://rogcarehindi.vercel.app/health-library",
    siteName: "Rog Care Hindi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Health Library - Symptoms, Tests & Treatments Guides | Rog Care Hindi",
    description: "Access our educational resource guides explaining clinical tests, symptoms analysis checklists, and treatment procedures.",
  },
};

export default async function HealthLibraryPage() {
  let items = [];

  try {
    const db = await getDb();
    items = await db.collection("library").find({}).toArray();
  } catch (error) {
    console.error("Health Library DB Query Error:", error);
    // Fallback static data in case of DB throttling
    items = [
      {
        type: "symptoms",
        slug: "chest-pain",
        title: "Chest Pain Guide",
        description: "Learn to distinguish between heart-related chest pain, respiratory conditions, and muscle strains.",
        content: "Chest pain should always be evaluated carefully. If it is crushing, accompanied by pain in your arm or jaw, seek emergency medical care immediately."
      },
      {
        type: "tests",
        slug: "blood-test",
        title: "Complete Blood Count (CBC)",
        description: "What does a blood test measure? Learn about red and white blood cells, platelets, and hemoglobin.",
        content: "A CBC is a common blood test used to evaluate your overall health and detect a wide range of disorders, including anemia and infection."
      }
    ];
  }

  const serializedItems = (items as Array<Record<string, any>>).map(item => ({
    type: item.type as string,
    slug: item.slug as string,
    title: item.title as string,
    description: item.description as string,
    content: item.content as string,
  }));

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh" }}>
      <HealthLibraryClient items={serializedItems} />
    </div>
  );
}
