import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeCountryName, normalizeRegionName } from "@/lib/geo";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/track
 * Saves minimized analytics using Vercel's trusted geolocation headers.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const path = typeof body.path === "string" ? body.path : "";
    const referrer = typeof body.referrer === "string" ? body.referrer : "";
    const visitorSessionId = typeof body.visitorSessionId === "string" ? body.visitorSessionId : "";

    if (!path.startsWith("/") || path.length > 512) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const decodeHeader = (value: string | null) => {
      if (!value) return "Unknown";
      try {
        return decodeURIComponent(value).slice(0, 100);
      } catch {
        return value.slice(0, 100);
      }
    };
    const userAgent = (request.headers.get("user-agent") || "Unknown").slice(0, 256);
    let safeReferrer = "Direct";
    try {
      if (referrer) {
        const parsedReferrer = new URL(referrer);
        safeReferrer = `${parsedReferrer.origin}${parsedReferrer.pathname}`.slice(0, 512);
      }
    } catch {
      safeReferrer = "Direct";
    }

    const db = await getDb();
    const analyticsCollection = db.collection("analytics");
    const sessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorSessionId)
      ? visitorSessionId
      : crypto.randomUUID();

    const rawCountry = request.headers.get("x-vercel-ip-country");
    const rawRegion = request.headers.get("x-vercel-ip-country-region");

    await analyticsCollection.insertOne({
      path,
      referrer: safeReferrer,
      userAgent,
      country: normalizeCountryName(rawCountry),
      region: normalizeRegionName(rawCountry, rawRegion),
      city: decodeHeader(request.headers.get("x-vercel-ip-city")),
      sessionId,
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Analytics tracking API error:", err);
    return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
  }
}
