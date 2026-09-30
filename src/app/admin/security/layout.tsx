import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { validateSession } from "@/lib/admin-auth";
import { getAdminLoginPath } from "@/lib/admin-login-path";
import { AdminFaviconBridge, AdminThemeBridge } from "../ThemeSettings";

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
    <>
      <AdminThemeBridge />
      <AdminFaviconBridge />
      <div className="admin-security-shell">
        <aside className="admin-security-sidebar">
          <div className="sidebar-brand">
            <span>⚕️</span> HealthEdu
          </div>
          <div className="admin-badge">ADMIN CONTROL</div>

          <nav className="sidebar-nav" aria-label="Admin navigation">
            <Link className="nav-item" href="/admin">📊 Dashboard Overview</Link>
            <Link className="nav-item" href="/admin/security/overview">⚙️ Security Overview</Link>
            <Link className="nav-item" href="/admin/security/ip-settings">🛡️ IP Settings</Link>
            <Link className="nav-item" href="/admin/security/email-login">✉️ Email Login Settings</Link>
          </nav>
        </aside>

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
      </div>
    </>
  );
}