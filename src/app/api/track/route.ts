import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/track
 * Receives page path and referrer, detects visitor's IP, performs GeoIP lookup,
 * and saves analytics event to MongoDB.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path, referrer } = body;

    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    // 1. Get visitor's IP address from headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    let ip = realIp || (forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1");

    // Clean IPv6 mapped IPv4 addresses (like ::ffff:127.0.0.1)
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // 2. Fetch User Agent
    const userAgent = request.headers.get("user-agent") || "Unknown";

    // 3. Geolocation Lookup
    let country = "Unknown";
    let region = "Unknown";
    let city = "Unknown";

    const isLocal =
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip.startsWith("192.168.") ||
      ip.startsWith("10.") ||
      ip.startsWith("172.16.") ||
      ip === "localhost";

    if (isLocal) {
      country = "Localhost";
      region = "Local Development";
      city = "Local Device";
    } else {
      try {
        const db = await getDb();
        const ipCacheCollection = db.collection("ip_cache");

        // Check if IP is already in cache
        const cached = await ipCacheCollection.findOne({ ip });

        if (cached) {
          country = cached.country || "Unknown";
          region = cached.region || "Unknown";
          city = cached.city || "Unknown";
        } else {
          // Fetch from IP-API (free, up to 45 requests/min)
          const geoRes = await fetch(`http://ip-api.com/json/${ip}`, {
            signal: AbortSignal.timeout(3000), // 3-second timeout
          });

          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.status === "success") {
              country = geoData.country || "Unknown";
              region = geoData.regionName || "Unknown"; // regionName is the full State/Province
              city = geoData.city || "Unknown";

              // Cache the result
              await ipCacheCollection.insertOne({
                ip,
                country,
                region,
                city,
                createdAt: new Date(),
              });
            }
          }
        }
      } catch (geoErr) {
        console.error("GeoIP Lookup error:", geoErr);
        // Fail silently and log visit anyway
      }
    }

    // 4. Save tracking hit to analytics collection
    const db = await getDb();
    const analyticsCollection = db.collection("analytics");

    // Generate a simple unique session ID based on IP and User Agent per calendar day
    const dateStr = new Date().toISOString().split("T")[0];
    // A simple pseudo-hash string
    const sessionId = Buffer.from(`${ip}-${userAgent}-${dateStr}`).toString("base64").substring(0, 16);

    await analyticsCollection.insertOne({
      path,
      referrer: referrer || "Direct",
      ip,
      userAgent,
      country,
      region,
      city,
      sessionId,
      timestamp: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Analytics tracking API error:", err);
    return NextResponse.json({ error: "Failed to track view" }, { status: 500 });
  }
}
