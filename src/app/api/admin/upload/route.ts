import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../login/route";
import { uploadToR2 } from "@/lib/r2";

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
 * Uploads the file to Cloudflare R2 and returns a permanent CDN URL.
 *
 * Previously: stored base64 in MongoDB "uploads" collection (~647 KB/doc)
 * Now:        uploads to R2, stores only a ~60-byte URL in content HTML
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

    // 10 MB limit (increased from 5 MB since R2 handles large files easily)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    const mimeType = file.type || "image/jpeg";
    const originalName = file.name || `upload-${Date.now()}`;

    // Convert File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudflare R2 — returns permanent public CDN URL
    const url = await uploadToR2(buffer, originalName, mimeType);

    return NextResponse.json({ url }, { status: 200 });
  } catch (err: any) {
    console.error("R2 upload error:", err);
    return NextResponse.json({ error: "Upload failed: " + (err.message || err) }, { status: 500 });
  }
}
