import { getDb } from "../src/lib/db";

async function testSearch(query: string) {
  const db = await getDb();
  
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
    .toArray();

  const allResults = [...diseaseResults];
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

    return { name: item.name, score };
  });

  const results = scoredResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  console.log(`Results for "${query}":`);
  console.log(results);
}

testSearch("Breast Cancer")
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
