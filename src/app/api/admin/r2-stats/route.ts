import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin_session")?.value;
    if (!(await validateSession(sessionToken))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { getR2Stats } = await import("@/lib/r2");
    const stats = await getR2Stats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Admin R2 stats error:", error);
    return NextResponse.json(
      {
        status: "Offline",
        error: "R2 stats could not be loaded. Check the server logs.",
      },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
}