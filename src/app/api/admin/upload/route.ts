import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../login/route";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticate(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  return await validateSession(sessionToken);
}

/**
 * POST /api/admin/upload
 * Accepts a multipart/form-data request with a "file" field.
 * Stores the image as a base64 string in MongoDB and returns a URL
 * that can be used to retrieve the image.
 * This approach works on Vercel (no local filesystem writes required).
 */
export async function POST(request: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 5 MB limit
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/jpeg";
    const originalName = file.name || "image";

    // Persist in MongoDB "uploads" collection
    const db = await getDb();
    const result = await db.collection("uploads").insertOne({
      filename: originalName,
      mimeType,
      data: base64,
      createdAt: new Date(),
    });

    const id = result.insertedId.toString();
    const url = `/api/admin/upload/${id}`;
    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
