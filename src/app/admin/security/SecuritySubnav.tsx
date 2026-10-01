"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SecuritySubnav() {
  const pathname = usePathname();
  return (
    <nav className="security-tabs" aria-label="Security settings">
      <Link className={pathname === "/admin/security/ip-settings" ? "active" : ""} href="/admin/security/ip-settings">
        IP Settings
      </Link>
      <Link className={pathname === "/admin/security/email-login" ? "active" : ""} href="/admin/security/email-login">
        Email Login Settings
      </Link>
      <Link className={pathname === "/admin/security/data-archive" ? "active" : ""} href="/admin/security/data-archive">
        Data Archive
      </Link>
    </nav>
  );
}