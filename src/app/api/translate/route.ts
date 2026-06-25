import { NextResponse } from "next/server";

// Runtime: edge or nodejs — keep nodejs for compatibility
export const runtime = "nodejs";

/**
 * GET /api/translate?to=hi&texts=["Home","Diseases","FAQ"]
 *
 * Proxies to Google Translate's free public endpoint.
 * No API key required.
 * Returns { translations: string[] }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetLang = searchParams.get("to");
  const textsParam = searchParams.get("texts");

  if (!targetLang || !textsParam) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  let texts: string[];
  try {
    texts = JSON.parse(textsParam);
    if (!Array.isArray(texts)) throw new Error("Not array");
  } catch {
    return NextResponse.json({ error: "Invalid texts param" }, { status: 400 });
  }

  // Translate each text individually (Google's free API handles one at a time)
  const translations = await Promise.all(
    texts.map((text) => translateOne(text, targetLang))
  );

  return NextResponse.json({ translations });
}

async function translateOne(text: string, targetLang: string): Promise<string> {
  if (!text || text.trim() === "") return text;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(text)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HealthEdu/1.0)",
      },
      // 5 second timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return text;

    const data = await res.json();
    // Response format: [[["translated","original",null,null,10],...],...]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((segment: any[]) => segment[0] ?? "")
        .join("");
      return translated || text;
    }
    return text;
  } catch {
    return text; // Fall back to original on error
  }
}
