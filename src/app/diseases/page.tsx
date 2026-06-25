import { getDb } from "@/lib/db";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

interface DiseaseItem {
  name: string;
  slug: string;
  categories: string[];
  overview: string;
}

export default async function DiseasesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; letter?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const searchQuery = resolvedSearchParams.search || "";
  const selectedLetter = resolvedSearchParams.letter || "";

  let diseases: DiseaseItem[] = [];
  let categories: { slug: string; name: string }[] = [];
  let errorMessage = "";

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, "");
  };

  try {
    const db = await getDb();
    categories = await db.collection("categories").find({}).project({ slug: 1, name: 1 }).toArray() as any;

    let diseaseList: DiseaseItem[] = [];
    let postList: any[] = [];

    if (searchQuery) {
      // Perform database text / regex search on diseases
      const criteria = {
        $or: [
          { name: { $regex: searchQuery, $options: "i" } },
          { overview: { $regex: searchQuery, $options: "i" } },
        ],
      };
      diseaseList = await db.collection("diseases")
        .find(criteria)
        .project({ name: 1, slug: 1, categories: 1, overview: 1 })
        .toArray() as any;

      // Search posts
      const postCriteria = {
        $or: [
          { title: { $regex: searchQuery, $options: "i" } },
          { content: { $regex: searchQuery, $options: "i" } }
        ]
      };
      postList = await db.collection("posts")
        .find(postCriteria)
        .project({ title: 1, slug: 1, category: 1, content: 1 })
        .toArray();
    } else if (selectedLetter) {
      // Filter by first letter
      const criteria = {
        name: { $regex: `^${selectedLetter}`, $options: "i" },
      };
      diseaseList = await db.collection("diseases")
        .find(criteria)
        .project({ name: 1, slug: 1, categories: 1, overview: 1 })
        .sort({ name: 1 })
        .toArray() as any;

      // Filter posts by letter category
      const postCriteria = {
        category: selectedLetter.toUpperCase(),
      };
      postList = await db.collection("posts")
        .find(postCriteria)
        .project({ title: 1, slug: 1, category: 1, content: 1 })
        .toArray();
    } else {
      // Show all diseases
      diseaseList = await db.collection("diseases")
        .find({})
        .project({ name: 1, slug: 1, categories: 1, overview: 1 })
        .sort({ name: 1 })
        .toArray() as any;

      // Fetch all posts
      postList = await db.collection("posts")
        .find({})
        .project({ title: 1, slug: 1, category: 1, content: 1 })
        .toArray();
    }

    // Map posts to unified DiseaseItem structure
    const mappedPosts = postList.map((post: any) => ({
      name: post.title,
      slug: post.slug || slugify(post.title),
      categories: ["articles"],
      overview: stripHtml(post.content).substring(0, 160) + "...",
    }));

    // Combine and sort alphabetically
    diseases = [...diseaseList, ...mappedPosts].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } catch (error) {
    console.error("Diseases Page Error:", error);
    errorMessage = "Failed to load diseases from database.";
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Map category slugs to names for quick badge rendering, with articles fallback
  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.slug] = cat.name;
    return acc;
  }, { "articles": "Articles" } as Record<string, string>);

  return (
    <div className="container" style={{ padding: "3rem 1.5rem" }}>
      <div className="text-center" style={{ marginBottom: "3rem" }}>
        <h1>Disease A-Z Directory</h1>
        <p className="text-muted" style={{ maxWidth: "600px", margin: "0 auto 2rem" }}>
          Find detailed information about symptoms, causes, diagnoses, treatment options, and prevention for over 100 diseases.
        </p>
        <SearchBar placeholder="Type to search... (e.g. Cancer, Dengue, Anemia)" />
      </div>

      {/* Alphabetical navigation */}
      <div
        className="flex-center"
        style={{
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "3rem",
          padding: "1rem",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
        }}
      >
        <Link
          href="/diseases"
          className="btn btn-secondary btn-sm"
          style={{
            backgroundColor: !selectedLetter ? "var(--primary-light)" : "",
            color: !selectedLetter ? "var(--primary)" : "",
            borderColor: !selectedLetter ? "var(--primary)" : "",
          }}
        >
          All
        </Link>
        {alphabet.map((letter) => (
          <Link
            key={letter}
            href={`/diseases?letter=${letter}`}
            className="btn btn-secondary btn-sm"
            style={{
              padding: "0.5rem 0.8rem",
              minWidth: "36px",
              backgroundColor: selectedLetter === letter ? "var(--primary-light)" : "",
              color: selectedLetter === letter ? "var(--primary)" : "",
              borderColor: selectedLetter === letter ? "var(--primary)" : "",
            }}
          >
            {letter}
          </Link>
        ))}
      </div>

      {/* Disease List */}
      <div>
        {errorMessage && (
          <div style={{ color: "var(--danger)", padding: "1.5rem", backgroundColor: "var(--surface)", borderRadius: "var(--radius-lg)" }}>
            {errorMessage}
          </div>
        )}

        {searchQuery && (
          <h2 style={{ marginBottom: "2rem", fontSize: "1.5rem" }}>
            Search Results for &quot;<span style={{ color: "var(--primary)" }}>{searchQuery}</span>&quot;
            <span className="text-muted" style={{ fontSize: "1rem", fontWeight: "normal", marginLeft: "0.5rem" }}>
              ({diseases.length} found)
            </span>
          </h2>
        )}

        {selectedLetter && (
          <h2 style={{ marginBottom: "2rem", fontSize: "1.5rem" }}>
            Diseases starting with &quot;<span style={{ color: "var(--primary)" }}>{selectedLetter}</span>&quot;
            <span className="text-muted" style={{ fontSize: "1rem", fontWeight: "normal", marginLeft: "0.5rem" }}>
              ({diseases.length} found)
            </span>
          </h2>
        )}

        {diseases.length === 0 ? (
          <div
            className="text-center"
            style={{
              padding: "4rem 2rem",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "3rem" }}>🔍</span>
            <h3 style={{ marginTop: "1rem" }}>No diseases found</h3>
            <p className="text-muted">
              We couldn&apos;t find any records matching your request. Try adjusting your search query or choosing another letter.
            </p>
          </div>
        ) : (
          <div className="grid-3">
            {diseases.map((disease) => (
              <div key={disease.slug} className="disease-grid-card">
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                    {disease.categories &&
                      disease.categories.map((catSlug) => (
                        <span
                          key={catSlug}
                          className="tag"
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            backgroundColor: "var(--primary-light)",
                            color: "var(--primary)",
                            borderRadius: "var(--radius-full)",
                            fontWeight: "600",
                          }}
                        >
                          {categoryMap[catSlug] || catSlug}
                        </span>
                      ))}
                  </div>
                  <h3 className="disease-grid-title">{disease.name}</h3>
                  <p className="disease-grid-desc">{disease.overview}</p>
                </div>
                <Link
                  href={`/diseases/${disease.slug}`}
                  className="btn btn-secondary btn-sm btn-block"
                  style={{ marginTop: "1rem" }}
                >
                  Read Article
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
