import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { validateSession } from "@/lib/admin-auth";
import { logServer } from "@/lib/server-logger";
import { ARCHIVE_CATEGORY_OPTIONS, ARCHIVE_RETENTION_OPTIONS, type ArchiveCategorySelection } from "@/lib/archive-config";
import {
  clearArchiveJob,
  getArchiveFile,
  getArchiveSettings,
  getArchiveSummary,
  runArchiveExport,
  updateArchiveSettings,
} from "@/lib/archive-r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  return validateSession(token);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  try {
    return Boolean(origin && new URL(origin).origin === new URL(request.url).origin);
  } catch {
    return false;
  }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isValidRetention(value: unknown): value is number {
  return typeof value === "number" && ARCHIVE_RETENTION_OPTIONS.some((option) => option.days === value);
}

function isValidArchiveCategory(value: unknown): value is ArchiveCategorySelection {
  return ARCHIVE_CATEGORY_OPTIONS.some((option) => option.value === value);
}

export async function GET(request: Request) {
  try {
    if (!(await ensureAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileName = new URL(request.url).searchParams.get("file");
    if (fileName !== null) {
      if (!/^(analytics|ip-security|server-logs)-archive-\d{4}-\d{2}-\d{2}(?:-\d{13})?\.xlsx?$/.test(fileName)) {
        return NextResponse.json({ error: "Invalid archive file name." }, { status: 400 });
      }
      const file = await getArchiveFile(fileName);
      return new NextResponse(Buffer.from(file), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "private, no-store, max-age=0",
        },
      });
    }

    const summary = await getArchiveSummary();
    return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Archive status fetch failed:", error);
    void logServer({ level: "error", message: "Archive status fetch failed", source: "admin.archive", path: "/api/admin/archive", method: "GET", statusCode: 500, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load archive status." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await ensureAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const settings = await getArchiveSettings();
    const category = body.category ?? settings.category;
    if (!isValidArchiveCategory(category)) {
      return NextResponse.json({ error: "Choose a supported archive category." }, { status: 400 });
    }

    const retentionDays = body.retentionDays ?? settings.retentionDays;
    if (!isValidRetention(retentionDays)) {
      return NextResponse.json({ error: "Choose a supported archive retention period." }, { status: 400 });
    }

    if (!settings.enabled) {
      return NextResponse.json({ error: "Data archiving is disabled. Enable it before starting an export." }, { status: 409 });
    }

    await updateArchiveSettings({ retentionDays, category });
    const result = await runArchiveExport(category, retentionDays);
    const hasFailures = result.results.some((item) => item.status === "failed");
    return NextResponse.json({ success: !hasFailures, ...result }, { status: hasFailures ? 502 : 200 });
  } catch (error) {
    console.error("Archive export failed:", error);
    void logServer({ level: "error", message: "Archive export failed", source: "admin.archive", path: "/api/admin/archive", method: "POST", statusCode: 500, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Archive export failed." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await ensureAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const updates: { enabled?: boolean; retentionDays?: number; category?: ArchiveCategorySelection } = {};
    if (Object.hasOwn(body, "enabled")) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "Archive status must be enabled or disabled." }, { status: 400 });
      }
      updates.enabled = body.enabled;
    }
    if (Object.hasOwn(body, "retentionDays")) {
      if (!isValidRetention(body.retentionDays)) {
        return NextResponse.json({ error: "Choose a supported archive retention period." }, { status: 400 });
      }
      updates.retentionDays = body.retentionDays;
    }
    if (Object.hasOwn(body, "category")) {
      if (!isValidArchiveCategory(body.category)) {
        return NextResponse.json({ error: "Choose a supported archive category." }, { status: 400 });
      }
      updates.category = body.category;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid archive settings were provided." }, { status: 400 });
    }

    return NextResponse.json(await updateArchiveSettings(updates), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Archive settings update failed:", error);
    void logServer({ level: "error", message: "Archive settings update failed", source: "admin.archive", path: "/api/admin/archive", method: "PATCH", statusCode: 500, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save archive settings." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await ensureAuthorized())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }

    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId || !/^[a-f\d]{24}$/i.test(jobId) || !ObjectId.isValid(jobId)) {
      return NextResponse.json({ error: "A valid archive job ID is required." }, { status: 400 });
    }

    const deleted = await clearArchiveJob(new ObjectId(jobId));
    if (!deleted) {
      return NextResponse.json({ error: "This archive entry was already cleared or does not exist." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Archive job clear failed:", error);
    void logServer({ level: "error", message: "Archive job clear failed", source: "admin.archive", path: "/api/admin/archive", method: "DELETE", statusCode: 500, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to clear the archive entry." }, { status: 500 });
  }
}
