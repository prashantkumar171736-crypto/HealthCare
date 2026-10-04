import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeCountryName, normalizeRegionName } from "@/lib/geo";
import crypto from "crypto";
import { logServer } from "@/lib/server-logger";

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
    const requestedBrowserLanguage = typeof body.browserLanguage === "string"
      ? body.browserLanguage.trim().slice(0, 35)
      : "";
    let browserLanguage = "Unknown";
    if (requestedBrowserLanguage) {
      try {
        browserLanguage = Intl.getCanonicalLocales(requestedBrowserLanguage)[0] || "Unknown";
      } catch {
        browserLanguage = "Unknown";
      }
    }

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
      browserLanguage,
      country: normalizeCountryName(rawCountry),
      region: normalizeRegionName(rawCountry, rawRegion),
      city: decodeHeader(request.headers.get("x-vercel-ip-city")),
      sessionId,
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Analytics tracking API error:", err);
    void logServer({ level: "error", message: "Analytics tracking request failed", source: "track", path: "/api/track", method: "POST", statusCode: 500, error: err });
    return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
  }
}
