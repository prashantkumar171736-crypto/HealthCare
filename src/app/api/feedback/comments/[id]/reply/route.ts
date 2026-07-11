import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { randomUUID } from "crypto";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
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
    if (content.trim().length > 1000) {
      return NextResponse.json(
        { error: "Reply too long (max 1000 chars)" },
        { status: 400 }
      );
    }

    const db = await getDb();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const reply = {
      replyId: randomUUID(),
      authorName: authorName.trim(),
      content: content.trim(),
      isAdmin: false,
      createdAt: new Date(),
    };

    const result = await db.collection("feedback_comments").updateOne(
      { _id: objectId },
      { $push: { replies: reply } as any }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, reply }, { status: 201 });
  } catch (error) {
    console.error("POST /api/feedback/comments/[id]/reply error:", error);
    return NextResponse.json(
      { error: "Failed to post reply" },
      { status: 500 }
    );
  }
}
