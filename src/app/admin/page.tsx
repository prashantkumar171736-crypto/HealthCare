import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionHash } from "../api/admin/login/route";
import DashboardClient from "./DashboardClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin page (Server Component)
 * Validates the session cookie and either renders the Dashboard Client or redirects to login.
 */
export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin_session")?.value;

  const username = process.env.ADMIN_USERNAME || "admin";
  const expectedHash = getSessionHash(username);

  // Authenticate session, redirect to login if invalid
  if (!sessionToken || sessionToken !== expectedHash) {
    redirect("/admin/login");
  }

  // Session valid: render the dashboard GUI client component
  return <DashboardClient />;
}
