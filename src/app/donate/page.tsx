import type { Metadata } from "next";
import DonateClient from "./DonateClient";

export const metadata: Metadata = {
  title: "Support Us - Donate for Free Healthcare Education | Rog Care Hindi",
  description: "Help us keep healthcare education and verified medical resources free, ad-free, and accessible to everyone by supporting our platform.",
  alternates: {
    canonical: "/donate",
  },
  openGraph: {
    title: "Support Us - Donate for Free Healthcare Education | Rog Care Hindi",
    description: "Help us keep healthcare education and verified medical resources free, ad-free, and accessible to everyone by supporting our platform.",
    url: "https://rogcarehindi.vercel.app/donate",
    siteName: "Rog Care Hindi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Support Us - Donate for Free Healthcare Education | Rog Care Hindi",
    description: "Help us keep healthcare education and verified medical resources free, ad-free, and accessible to everyone by supporting our platform.",
  },
};

export default function DonatePage() {
  return <DonateClient />;
}
