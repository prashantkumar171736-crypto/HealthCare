"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { LANG_MAP } from "@/lib/detectLanguage";
import { useTranslation } from "@/hooks/useTranslation";

const NAV_STRINGS = {
  home: "Home",
  diseases: "Diseases",
  healthLibrary: "Health Library",
  healthTips: "Health Tips",
  faq: "FAQ",
  about: "About",
  donate: "Donate",
  resetLang: "Reset to English",
};

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { lang, setLangByCode, resetToEnglish, isTranslating } = useLanguage();
  const { t } = useTranslation(NAV_STRINGS);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const links = [
    { href: "/", label: t("home") },
    { href: "/diseases", label: t("diseases") },
    { href: "/health-library", label: t("healthLibrary") },
    { href: "/health-tips", label: t("healthTips") },
    { href: "/faq", label: t("faq") },
    { href: "/about", label: t("about") },
  ];

  const isNonEnglish = lang.code !== "en";

  return (
    <>
      <header className="navbar-wrapper">
        <div className="container navbar">
          <div className="logo-wrapper" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Link href="/" className="logo" onClick={closeMenu}>
              <span>⚕️</span> HealthEdu
            </Link>
            <select value={lang.code} onChange={(e) => setLangByCode(e.target.value)} style={{
              padding: "0.2rem",
              borderRadius: "4px",
              border: "1px solid var(--primary)",
              background: "var(--primary-light)"
            }}>
              {LANG_MAP.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>

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
                  {t("donate")} ❤️
                </Link>
              </li>

              {/* Language indicator + Reset button */}
              {isNonEnglish && (
                <li>
                  <button
                    onClick={resetToEnglish}
                    title="Reset to English"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.3rem 0.7rem",
                      borderRadius: "999px",
                      border: "1.5px solid var(--primary)",
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isTranslating ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        style={{ animation: "spin 1s linear infinite" }}
                      >
                        <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
                      </svg>
                    ) : (
                      "🌐"
                    )}
                    {lang.name} · {t("resetLang")}
                  </button>
                </li>
              )}
            </ul>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-toggle"
            onClick={toggleMenu}
            aria-label="Toggle Menu"
          >
            {isOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div
        className={`drawer-overlay ${isOpen ? "show" : ""}`}
        onClick={closeMenu}
      />
      <div className={`mobile-drawer ${isOpen ? "open" : ""}`}>
        <div className="mobile-drawer-header">
          <div className="logo-wrapper" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Link href="/" className="logo" onClick={closeMenu}>
              <span>⚕️</span> HealthEdu
            </Link>
            <select value={lang.code} onChange={(e) => setLangByCode(e.target.value)} style={{
              padding: "0.2rem",
              borderRadius: "4px",
              border: "1px solid var(--primary)",
              background: "var(--primary-light)"
            }}>
              {LANG_MAP.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <button
            className="mobile-menu-toggle"
            onClick={closeMenu}
            aria-label="Close Menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
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
              {t("donate")} ❤️
            </Link>
          </li>
          {isNonEnglish && (
            <li style={{ marginTop: "0.75rem" }}>
              <button
                onClick={() => {
                  resetToEnglish();
                  closeMenu();
                }}
                style={{
                  width: "100%",
                  padding: "0.6rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1.5px solid var(--primary)",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                🌐 {lang.name} · {t("resetLang")}
              </button>
            </li>
          )}
        </ul>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
