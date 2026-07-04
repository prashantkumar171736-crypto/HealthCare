import type { Metadata } from "next";
import HealthTipsClient from "./HealthTipsClient";

export const metadata: Metadata = {
  title: "Health Tips & Wellness Guide | Rog Care Hindi",
  description: "Evidence-based health tips covering nutrition, fitness, mental health, sleep hygiene, hydration, and disease prevention — sourced from WHO and NIH guidelines.",
  alternates: {
    canonical: "/health-tips",
  },
  openGraph: {
    title: "Health Tips & Wellness Guide | Rog Care Hindi",
    description: "Evidence-based health tips covering nutrition, fitness, mental health, sleep hygiene, hydration, and disease prevention.",
    url: "https://rogcarehindi.vercel.app/health-tips",
    siteName: "Rog Care Hindi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Health Tips & Wellness Guide | Rog Care Hindi",
    description: "Evidence-based health tips covering nutrition, fitness, mental health, sleep hygiene, hydration, and disease prevention.",
  },
};

export default function HealthTipsPage() {
  return <HealthTipsClient />;
}

