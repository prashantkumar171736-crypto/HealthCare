"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/diseases", label: "Diseases" },
    { href: "/health-library", label: "Health Library" },
    { href: "/health-tips", label: "Health Tips" },
    { href: "/faq", label: "FAQ" },
    { href: "/about", label: "About" },
  ];


  return (
    <>
      <header className="navbar-wrapper">
        <div className="container navbar">
          <Link href="/" className="logo" onClick={closeMenu}>
            <span>⚕️</span> HealthEdu
          </Link>

          {/* Desktop Nav Links */}
          <nav>
            <ul className="nav-links">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`nav-link ${pathname === link.href ? "active" : ""}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/donate" className="nav-link-donate">
                  Donate ❤️
                </Link>
              </li>
            </ul>
          </nav>

          {/* Mobile Menu Button */}
          <button className="mobile-menu-toggle" onClick={toggleMenu} aria-label="Toggle Menu">
            {isOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`drawer-overlay ${isOpen ? "show" : ""}`} onClick={closeMenu} />
      <div className={`mobile-drawer ${isOpen ? "open" : ""}`}>
        <div className="mobile-drawer-header">
          <Link href="/" className="logo" onClick={closeMenu}>
            <span>⚕️</span> HealthEdu
          </Link>
          <button className="mobile-menu-toggle" onClick={closeMenu} aria-label="Close Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul className="mobile-drawer-links">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`nav-link ${pathname === link.href ? "active" : ""}`}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li style={{ marginTop: "1rem" }}>
            <Link
              href="/donate"
              className="btn btn-accent btn-accent-glow btn-block"
              onClick={closeMenu}
            >
              Donate ❤️
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
