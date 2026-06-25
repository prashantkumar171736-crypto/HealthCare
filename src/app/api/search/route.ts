import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const db = await getDb();
    
    // Find matching diseases
    let searchCriteria = {};
    if (query.trim().length > 0) {
      searchCriteria = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { overview: { $regex: query, $options: "i" } }
        ]
      };
    }

    const diseaseResults = await db.collection("diseases")
      .find(searchCriteria)
      .project({ name: 1, slug: 1, categories: 1, overview: 1 })
      .limit(10)
      .toArray();

    // Find matching posts
    let postCriteria = {};
    if (query.trim().length > 0) {
      postCriteria = {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { content: { $regex: query, $options: "i" } }
        ]
      };
    }

    const postResults = await db.collection("posts")
      .find(postCriteria)
      .project({ title: 1, slug: 1, content: 1 })
      .limit(10)
      .toArray();

    // Map posts to match the disease results format
    const mappedPosts = postResults.map((post: any) => ({
      name: post.title,
      slug: post.slug || slugify(post.title),
      categories: ["articles"],
      overview: stripHtml(post.content).substring(0, 160) + "..."
    }));

    // Combine and limit to 10 suggestions
    const results = [...diseaseResults, ...mappedPosts].slice(0, 10);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  }
}

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}
