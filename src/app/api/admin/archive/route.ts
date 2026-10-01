import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/admin-auth";
import { getArchiveSummary, runArchiveExport } from "@/lib/archive-r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  return validateSession(token);
}

export async function GET() {
  try {
    if (!(await ensureAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getArchiveSummary();
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Archive status fetch failed:", error);
    return NextResponse.json({ error: "Failed to load archive status." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await ensureAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const category = typeof body.category === "string" ? body.category : "all";
    const retentionDays = Number(body.retentionDays ?? 30);
    const allowedRetentionDays = [1, 7, 30, 90, 182, 365];
    if (!allowedRetentionDays.includes(retentionDays)) {
      return NextResponse.json({ error: "Choose a supported archive retention period." }, { status: 400 });
    }

    const result = await runArchiveExport(category as "all" | "analytics" | "ip-security" | "server-logs", retentionDays);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("Archive export failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Archive export failed." }, { status: 500 });
  }
}
