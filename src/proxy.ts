import { NextResponse, type NextRequest } from "next/server";
import { revokeSession, validateSession } from "@/lib/admin-auth";
import { getAdminLoginPath } from "@/lib/admin-login-path";

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isPageNavigation(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-dest") === "document") return true;
  return request.headers.has("rsc") && !request.headers.has("next-router-prefetch");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const loginPath = getAdminLoginPath();
  const sessionToken = request.cookies.get("admin_session")?.value;

  if (pathname === "/admin/login") {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  if (loginPath && pathname === loginPath) {
    if (sessionToken && await validateSession(sessionToken)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    const response = NextResponse.rewrite(new URL("/admin/login", request.url));
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.next();
  }

  if (isAdminPath(pathname) || !isPageNavigation(request)) {
    return NextResponse.next();
  }

  await revokeSession(sessionToken);

  const loginUrl = new URL(loginPath ?? "/", request.url);
  loginUrl.searchParams.set("reason", "admin-area-only");
  const response = NextResponse.redirect(
    loginUrl
  );
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next/|favicon.ico|.*\\.[^/]+$).*)"],
};