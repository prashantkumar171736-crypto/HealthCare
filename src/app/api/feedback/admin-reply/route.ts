import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { validateSession } from "@/app/api/admin/login/route";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    return await validateSession(token);
  } catch {
    return false;
  }
}

/**
 * POST /api/feedback/admin-reply
 * Admin-only: add a reply with isAdmin=true to any comment.
 * Body: { commentId: string, content: string }
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { commentId, content } = body;

    if (!commentId?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "commentId and content are required" },
        { status: 400 }
      );
    }

    if (content.trim().length > 2000) {
      return NextResponse.json(
        { error: "Reply too long (max 2000 chars)" },
        { status: 400 }
      );
    }

    const db = await getDb();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(commentId);
    } catch {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const reply = {
      replyId: randomUUID(),
      authorName: "HealthEdu Admin",
      content: content.trim(),
      isAdmin: true,
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
    console.error("POST /api/feedback/admin-reply error:", error);
    return NextResponse.json({ error: "Failed to post admin reply" }, { status: 500 });
  }
}

/**
 * DELETE /api/feedback/admin-reply
 * Admin-only: delete a comment or reply.
 * Body: { commentId: string, replyId?: string }
 *   - If replyId is provided, removes that specific reply from the comment.
 *   - If only commentId, deletes the entire comment.
 */
export async function DELETE(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { commentId, replyId } = body;

    if (!commentId?.trim()) {
      return NextResponse.json({ error: "commentId is required" }, { status: 400 });
    }

    const db = await getDb();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(commentId);
    } catch {
      return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
    }

    if (replyId) {
      // Delete specific reply
      const result = await db.collection("feedback_comments").updateOne(
        { _id: objectId },
        { $pull: { replies: { replyId } } as any }
      );
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: "reply" });
    } else {
      // Delete entire comment
      const result = await db
        .collection("feedback_comments")
        .deleteOne({ _id: objectId });
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: "comment" });
    }
  } catch (error) {
    console.error("DELETE /api/feedback/admin-reply error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
