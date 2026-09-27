import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * GET /api/admin/logout
 * Clears the session cookie and redirects to the login page.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
    });

    const url = new URL("/admin/login", request.url);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Admin logout error:", err);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}

/**
 * POST /api/admin/logout
 * Clears the session cookie and returns a JSON success.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("admin_session", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin logout error:", err);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
