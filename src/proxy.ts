import { NextResponse, type NextRequest } from "next/server";
import { revokeSession, validateSession } from "./app/api/admin/login/route";

function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isPageNavigation(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-dest") === "document") return true;
  return request.headers.has("rsc") && !request.headers.has("next-router-prefetch");
}

export async function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get("admin_session")?.value;
  if (!sessionToken || !(await validateSession(sessionToken))) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isAdminPath(pathname) || !isPageNavigation(request)) {
    return NextResponse.next();
  }

  await revokeSession(sessionToken);

  const response = NextResponse.redirect(
    new URL("/admin/login?reason=admin-area-only", request.url)
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