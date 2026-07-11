import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const db = await getDb();
    const comments = await db
      .collection("feedback_comments")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("GET /api/feedback/comments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorName, content } = body;

    if (!authorName?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Author name and content are required" },
        { status: 400 }
      );
    }

    if (authorName.trim().length > 60) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }
    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "Comment too long (max 2000 chars)" }, { status: 400 });
    }

    const db = await getDb();
    const newComment = {
      commentId: randomUUID(),
      authorName: authorName.trim(),
      content: content.trim(),
      createdAt: new Date(),
      replies: [],
    };

    const result = await db.collection("feedback_comments").insertOne(newComment);

    return NextResponse.json(
      { success: true, id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/feedback/comments error:", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 }
    );
  }
}
