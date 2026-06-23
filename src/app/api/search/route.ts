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
    // Perform text search if query is longer, otherwise perform regex prefix/contains match
    let searchCriteria = {};
    if (query.trim().length > 0) {
      searchCriteria = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { overview: { $regex: query, $options: "i" } }
        ]
      };
    }

    const results = await db.collection("diseases")
      .find(searchCriteria)
      .project({ name: 1, slug: 1, categories: 1, overview: 1 })
      .limit(10)
      .toArray();

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  }
}
