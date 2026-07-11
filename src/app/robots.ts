import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rogcarehindi.vercel.app";

  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: ["/", "/api/search"],
        disallow: ["/admin/", "/api/feedback/", "/api/admin/"],
      },
      {
        userAgent: "Bingbot",
        allow: ["/", "/api/search"],
        disallow: ["/admin/", "/api/feedback/", "/api/admin/"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
