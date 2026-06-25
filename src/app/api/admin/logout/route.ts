import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/**
 * GET /api/admin/logout
 * Clears the session cookie and redirects to the login page.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");

    // Redirect to login page
    return NextResponse.redirect(new URL("/admin/login", "http://localhost:3000")); // Fallback URL, handled by client/server relative redirect
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
    cookieStore.delete("admin_session");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin logout error:", err);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
