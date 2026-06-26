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
    const words = query.trim().split(/\s+/).filter(Boolean);
    let searchCriteria = {};
    if (words.length > 0) {
      searchCriteria = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { overview: { $regex: query, $options: "i" } },
          ...words.flatMap(word => [
            { name: { $regex: word, $options: "i" } },
            { overview: { $regex: word, $options: "i" } },
            { categories: { $regex: word, $options: "i" } }
          ])
        ]
      };
    }

    const diseaseResults = await db.collection("diseases")
      .find(searchCriteria)
      .project({ name: 1, slug: 1, categories: 1, overview: 1 })
      .limit(50)
      .toArray();

    // Find matching posts
    let postCriteria = {};
    if (words.length > 0) {
      postCriteria = {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { content: { $regex: query, $options: "i" } },
          ...words.flatMap(word => [
            { title: { $regex: word, $options: "i" } },
            { content: { $regex: word, $options: "i" } }
          ])
        ]
      };
    }

    const postResults = await db.collection("posts")
      .find(postCriteria)
      .project({ title: 1, slug: 1, content: 1 })
      .limit(50)
      .toArray();

    // Map posts to match the disease results format
    const mappedPosts = postResults.map((post: any) => ({
      name: post.title,
      slug: post.slug || slugify(post.title),
      categories: ["articles"],
      overview: stripHtml(post.content).substring(0, 160) + "..."
    }));

    // Combine and score
    const allResults = [...diseaseResults, ...mappedPosts];
    const scoredResults = allResults.map((item: any) => {
      let score = 0;
      const lowerQuery = query.toLowerCase();
      const lowerName = item.name.toLowerCase();
      const lowerOverview = (item.overview || "").toLowerCase();

      // Exact full query match
      if (lowerName.includes(lowerQuery)) {
        score += 100;
      } else if (lowerOverview.includes(lowerQuery)) {
        score += 50;
      }

      // Word matches
      words.forEach(word => {
        const lowerWord = word.toLowerCase();
        if (lowerName.includes(lowerWord)) {
          score += 15;
        }
        if (lowerOverview.includes(lowerWord)) {
          score += 5;
        }
        if (item.categories && item.categories.some((c: string) => c.toLowerCase().includes(lowerWord))) {
          score += 8;
        }
      });

      return { item, score };
    });

    // Sort by score descending and take top 10
    const results = scoredResults
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .map(r => r.item)
      .slice(0, 10);

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
