import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";

export const revalidate = 86400; // Cache sitemap for 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rogcarehindi.vercel.app";

  // Static routes
  const staticPaths = [
    "",
    "/about",
    "/disclaimer",
    "/donate",
    "/faq",
    "/terms",
    "/privacy-policy",
    "/health-tips",
    "/health-library",
    "/diseases",
  ];

  const staticUrls = staticPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : path === "/diseases" ? 0.9 : 0.7,
  }));

  try {
    const db = await getDb();

    // Fetch categories
    const categories = await db
      .collection("categories")
      .find({})
      .project({ slug: 1 })
      .toArray();

    const categoryUrls = categories.map((cat) => ({
      url: `${baseUrl}/diseases/category/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Fetch diseases
    const diseases = await db
      .collection("diseases")
      .find({})
      .project({ slug: 1 })
      .toArray();

    const diseaseUrls = diseases.map((disease) => ({
      url: `${baseUrl}/diseases/${disease.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Fetch posts
    const posts = await db
      .collection("posts")
      .find({})
      .project({ slug: 1 })
      .toArray();

    const postUrls = posts.map((post) => ({
      url: `${baseUrl}/diseases/${post.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticUrls, ...categoryUrls, ...diseaseUrls, ...postUrls];
  } catch (error) {
    console.error("Sitemap generation database error, returning static routes only:", error);
    return staticUrls;
  }
}
