import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSessionHash } from "../login/route";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticate(): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;
  const username = process.env.ADMIN_USERNAME || "admin";
  const expectedHash = getSessionHash(username);
  return !!(sessionToken && sessionToken === expectedHash);
}

/** GET /api/admin/posts — List all posts, sorted by title A-Z */
export async function GET() {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const posts = await db
      .collection("posts")
      .find({})
      .sort({ title: 1 })
      .toArray();

    return NextResponse.json({ posts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** POST /api/admin/posts — Create a new post */
export async function POST(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, content } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    const letter = title.trim()[0].toUpperCase();
    const category = /^[A-Z]$/.test(letter) ? letter : "#";

    const result = await db.collection("posts").insertOne({
      title: title.trim(),
      content,
      category,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { message: "Post uploaded successfully", id: result.insertedId.toString(), category },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** DELETE /api/admin/posts?id=<objectId> — Delete a post */
export async function DELETE(req: NextRequest) {
  if (!(await authenticate())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db
      .collection("posts")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Post deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
