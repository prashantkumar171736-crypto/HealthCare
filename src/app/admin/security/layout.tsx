import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { validateSession } from "@/lib/admin-auth";
import { getAdminLoginPath } from "@/lib/admin-login-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SecurityLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const valid = await validateSession(cookieStore.get("admin_session")?.value);
  if (!valid) {
    const loginPath = getAdminLoginPath();
    if (!loginPath) notFound();
    redirect(loginPath);
  }

  return (
    <main className="security-layout">
      <div className="security-layout-inner">
        <header className="security-header">
          <div>
            <Link className="security-back" href="/admin">← Admin dashboard</Link>
            <h1>Security</h1>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}