import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/upload/[id]
 * Serves a previously uploaded image stored in MongoDB.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
    }

    const db = await getDb();
    const doc = await db.collection("uploads").findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const buffer = Buffer.from(doc.data as string, "base64");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType as string,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Image serve error:", err);
    return NextResponse.json({ error: "Failed to retrieve image" }, { status: 500 });
  }
}
