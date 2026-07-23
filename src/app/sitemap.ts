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
    "/feedback",
  ];

  const getPriority = (path: string) => {
    switch (path) {
      case "":
        return 1.0;
      case "/diseases":
        return 0.9;
      case "/health-library":
        return 0.85;
      case "/health-tips":
      case "/feedback":
        return 0.8;
      case "/faq":
      case "/about":
        return 0.7;
      default:
        return 0.5;
    }
  };

  const getChangeFrequency = (path: string) => {
    switch (path) {
      case "":
      case "/diseases":
      case "/feedback":
        return "daily" as const;
      case "/health-tips":
      case "/health-library":
      case "/faq":
        return "weekly" as const;
      default:
        return "monthly" as const;
    }
  };

  const staticUrls = staticPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: getChangeFrequency(path),
    priority: getPriority(path),
    alternates: {
      languages: {
        en: `${baseUrl}${path}`,
        hi: `${baseUrl}${path}`,
      },
    },
  }));

  try {
    const db = await getDb();

    // Fetch categories (15 entries)
    const categories = await db
      .collection("categories")
      .find({})
      .project({ slug: 1, updatedAt: 1 })
      .toArray();

    const categoryUrls = categories.map((cat) => ({
      url: `${baseUrl}/diseases/category/${cat.slug}`,
      lastModified: cat.updatedAt ? new Date(cat.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: {
        languages: {
          en: `${baseUrl}/diseases/category/${cat.slug}`,
          hi: `${baseUrl}/diseases/category/${cat.slug}`,
        },
      },
    }));

    // Fetch diseases (105 entries)
    const diseases = await db
      .collection("diseases")
      .find({})
      .project({ slug: 1, updatedAt: 1 })
      .toArray();

    const diseaseUrls = diseases.map((disease) => ({
      url: `${baseUrl}/diseases/${disease.slug}`,
      lastModified: disease.updatedAt ? new Date(disease.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.85,
      alternates: {
        languages: {
          en: `${baseUrl}/diseases/${disease.slug}`,
          hi: `${baseUrl}/diseases/${disease.slug}`,
        },
      },
    }));

    // Fetch health library articles (21 entries — symptoms, tests & treatments guides)
    const libraryItems = await db
      .collection("library")
      .find({})
      .project({ slug: 1, updatedAt: 1 })
      .toArray();

    const libraryUrls = libraryItems.map((item) => ({
      url: `${baseUrl}/health-library/${item.slug}`,
      lastModified: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.75,
      alternates: {
        languages: {
          en: `${baseUrl}/health-library/${item.slug}`,
          hi: `${baseUrl}/health-library/${item.slug}`,
        },
      },
    }));

    // Fetch health tips articles (only those with a slug field)
    const tipsItems = await db
      .collection("tips")
      .find({ slug: { $exists: true, $ne: null } })
      .project({ slug: 1, updatedAt: 1 })
      .toArray();

    const tipsUrls = tipsItems.map((tip) => ({
      url: `${baseUrl}/health-tips/${tip.slug}`,
      lastModified: tip.updatedAt ? new Date(tip.updatedAt) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: {
        languages: {
          en: `${baseUrl}/health-tips/${tip.slug}`,
          hi: `${baseUrl}/health-tips/${tip.slug}`,
        },
      },
    }));

    // Fetch posts — long-form articles (e.g. Cancer overview, linked under /diseases/)
    const posts = await db
      .collection("posts")
      .find({})
      .project({ slug: 1, updatedAt: 1 })
      .toArray();

    const postUrls = posts.map((post) => ({
      url: `${baseUrl}/diseases/${post.slug}`,
      lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
      alternates: {
        languages: {
          en: `${baseUrl}/diseases/${post.slug}`,
          hi: `${baseUrl}/diseases/${post.slug}`,
        },
      },
    }));

    return [
      ...staticUrls,
      ...categoryUrls,
      ...diseaseUrls,
      ...libraryUrls,
      ...tipsUrls,
      ...postUrls,
    ];
  } catch (error) {
    console.error("Sitemap generation database error, returning static routes only:", error);
    return staticUrls;
  }
}
