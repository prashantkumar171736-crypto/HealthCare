import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/context/LanguageContext";
import Tracker from "@/components/Tracker";
import PageTranslator from "@/components/PageTranslator";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rogcarehindi.vercel.app"),
  title: {
    default: "Rog Care Hindi | Trusted Healthcare Education Platform",
    template: "%s | Rog Care Hindi",
  },
  description:
    "Learn about diseases, symptoms, causes, diagnoses, prevention strategies, and healthy living in Hindi & English. Free medical resources updated by health professionals.",
  keywords: [
    "healthcare education",
    "diseases symptoms",
    "prevention strategies",
    "healthy living",
    "medical directory",
    "disease list",
    "Rog Care Hindi",
    "rogcarehindi",
    "रोग केयर हिंदी",
    "बीमारी के लक्षण",
    "स्वास्थ्य टिप्स"
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rog Care Hindi | Trusted Healthcare Education Platform",
    description: "Learn about diseases, symptoms, causes, diagnoses, prevention strategies, and healthy living.",
    url: "https://rogcarehindi.vercel.app",
    siteName: "Rog Care Hindi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Rog Care Hindi Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rog Care Hindi | Trusted Healthcare Education Platform",
    description: "Learn about diseases, symptoms, causes, diagnoses, prevention strategies, and healthy living.",
    images: ["/logo.png"],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang and dir are set dynamically by LanguageContext on the client;
    // defaults are "en" / "ltr" for SSR.
    <html lang="en" dir="ltr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
        <LanguageProvider>
          <Tracker />
          <PageTranslator />
          <Navbar />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}

