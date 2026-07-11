"use client";

import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

const FOOTER_STRINGS = {
  brandDesc: "Your trusted healthcare education platform. Empowering everyone with accurate, peer-reviewed medical information.",
  quickLinks: "Quick Links",
  home: "Home",
  diseaseIndex: "Disease Index",
  healthLibrary: "Health Library",
  healthTips: "Health Tips",
  faqs: "FAQs",
  donate: "Donate",
  legal: "Legal",
  privacy: "Privacy Policy",
  terms: "Terms & Conditions",
  disclaimer: "Medical Disclaimer",
  contact: "Contact Us",
  contactDesc: "Share your thoughts, suggestions, or questions with our community.",
  commentsFeedback: "Comment / Feedback",
  medicalDisclaimerTitle: "Medical Disclaimer:",
  medicalDisclaimerText: "The content provided on HealthEdu is for educational and informational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read on this website.",
  rightsReserved: "All rights reserved. Built for Healthcare Education.",
  adminPortal: "Admin Portal",
};

export default function Footer() {
  const { t } = useTranslation(FOOTER_STRINGS);

  return (
    <footer className="footer-wrapper">
      <div className="container footer-grid">
        {/* Col 1: Brand and Intro */}
        <div>
          <h3 className="logo" style={{ marginBottom: "1rem" }}>
            <span>⚕️</span> HealthEdu
          </h3>
          <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            {t("brandDesc")}
          </p>
          <div className="footer-socials">
            <a href="https://instagram.com" className="footer-social-link" target="_blank" rel="noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01"/>
              </svg>
            </a>
            <a href="https://facebook.com" className="footer-social-link" target="_blank" rel="noreferrer" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a href="https://linkedin.com" className="footer-social-link" target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
            <a href="https://youtube.com" className="footer-social-link" target="_blank" rel="noreferrer" aria-label="YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Col 2: Quick Links */}
        <div>
          <h4 className="footer-col-title">{t("quickLinks")}</h4>
          <ul className="footer-links">
            <li><Link href="/">{t("home")}</Link></li>
            <li><Link href="/diseases">{t("diseaseIndex")}</Link></li>
            <li><Link href="/health-library">{t("healthLibrary")}</Link></li>
            <li><Link href="/health-tips">{t("healthTips")}</Link></li>
            <li><Link href="/faq">{t("faqs")}</Link></li>
            <li><Link href="/donate">{t("donate")} ❤️</Link></li>
          </ul>
        </div>

        {/* Col 3: Legal */}
        <div>
          <h4 className="footer-col-title">{t("legal")}</h4>
          <ul className="footer-links">
            <li><Link href="/privacy-policy">{t("privacy")}</Link></li>
            <li><Link href="/terms">{t("terms")}</Link></li>
            <li><Link href="/disclaimer">{t("disclaimer")}</Link></li>
            <li><Link href="/admin">🛡️ {t("adminPortal")}</Link></li>
          </ul>
        </div>

        {/* Col 4: Contact Us */}
        <div>
          <h4 className="footer-col-title">{t("contact")}</h4>
          <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            {t("contactDesc")}
          </p>
          <Link href="/feedback" className="btn btn-primary btn-sm" style={{ marginTop: "0.5rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t("commentsFeedback")}
          </Link>
        </div>
      </div>

      <div className="container">
        <div className="footer-sitemap">
          <h4 className="footer-sitemap-title">Disease Categories &amp; Resources</h4>
          <div className="footer-sitemap-links">
            <Link href="/diseases/category/cancer" className="footer-sitemap-link">Cancer (कैंसर)</Link>
            <Link href="/diseases/category/heart-diseases" className="footer-sitemap-link">Heart Diseases (हृदय रोग)</Link>
            <Link href="/diseases/category/diabetes" className="footer-sitemap-link">Diabetes (मधुमेह)</Link>
            <Link href="/diseases/category/respiratory-diseases" className="footer-sitemap-link">Respiratory Diseases (श्वास रोग)</Link>
            <Link href="/health-tips" className="footer-sitemap-link">Health Tips (स्वास्थ्य सुझाव)</Link>
            <Link href="/health-library" className="footer-sitemap-link">Health Library (चिकित्सा संदर्भ)</Link>
            <Link href="/feedback" className="footer-sitemap-link">Community Forum (प्रतिक्रिया और चर्चा)</Link>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="footer-disclaimer">
          <p style={{ fontWeight: "600", marginBottom: "0.5rem" }}>⚠️ {t("medicalDisclaimerTitle")}</p>
          <p>
            {t("medicalDisclaimerText")}
          </p>
          <p style={{ marginTop: "1rem" }}>
            © {new Date().getFullYear()} HealthEdu. {t("rightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
