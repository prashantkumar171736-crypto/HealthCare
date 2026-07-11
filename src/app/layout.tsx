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
  applicationName: "Rog Care Hindi",
  authors: [{ name: "Rog Care Hindi Editorial Team", url: "https://rogcarehindi.vercel.app/about" }],
  creator: "Rog Care Hindi",
  publisher: "Rog Care Hindi",
  title: {
    default: "Rog Care Hindi | Trusted Healthcare Education Platform",
    template: "%s | Rog Care Hindi",
  },
  description:
    "Learn about diseases, symptoms, causes, diagnoses, prevention strategies, and healthy living in Hindi & English. Free peer-reviewed medical education resources.",
  keywords: [
    // English — Core Medical
    "healthcare education", "disease symptoms", "disease causes", "disease treatment",
    "disease prevention", "medical guide", "health information", "medical directory",
    "disease list", "symptoms checker", "health library", "medical articles",
    "health tips", "wellness guide", "doctor advice", "clinical information",
    // English — Conditions
    "diabetes symptoms", "cancer information", "heart disease", "respiratory disease",
    "digestive disorders", "skin diseases", "mental health", "blood pressure",
    "thyroid disorders", "kidney disease", "liver disease", "bone diseases",
    "reproductive health", "women health", "men health", "child health",
    "immunity boost", "stamina", "sexual health education", "sexual wellness",
    "reproductive system", "fertility", "hormonal health",
    // English — Platform
    "Rog Care Hindi", "rogcarehindi", "free health education", "Hindi health website",
    "health education India", "Indian medical guide", "Ayurveda health",
    // Hindi — Core
    "रोग केयर हिंदी", "बीमारी के लक्षण", "स्वास्थ्य टिप्स", "रोग का इलाज",
    "बीमारी की जानकारी", "स्वास्थ्य शिक्षा", "हिंदी मेडिकल गाइड", "रोग निदान",
    "घरेलू उपाय", "आयुर्वेदिक उपचार", "बीमारी से बचाव", "स्वस्थ जीवन",
    "मधुमेह लक्षण", "हृदय रोग", "श्वास रोग", "त्वचा रोग", "पाचन तंत्र",
    "मानसिक स्वास्थ्य", "महिला स्वास्थ्य", "पुरुष स्वास्थ्य", "बच्चों का स्वास्थ्य",
    "यौन स्वास्थ्य", "प्रजनन स्वास्थ्य", "रोग प्रतिरोधक क्षमता", "ऊर्जा और स्टेमिना",
    "थायरॉइड", "रक्तचाप", "कैंसर जानकारी", "किडनी रोग", "लिवर रोग",
    "हड्डी रोग", "हार्मोनल स्वास्थ्य",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "https://rogcarehindi.vercel.app",
      "hi-IN": "https://rogcarehindi.vercel.app",
    },
  },
  openGraph: {
    title: "Rog Care Hindi | Trusted Healthcare Education Platform",
    description:
      "Learn about diseases, symptoms, causes, diagnoses, prevention strategies, and healthy living in Hindi & English. Free peer-reviewed medical resources.",
    url: "https://rogcarehindi.vercel.app",
    siteName: "Rog Care Hindi",
    locale: "en_US",
    alternateLocale: ["hi_IN"],
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Rog Care Hindi — Free Healthcare Education",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@rogcarehindi",
    creator: "@rogcarehindi",
    title: "Rog Care Hindi | Trusted Healthcare Education Platform",
    description:
      "Free medical education in Hindi & English — diseases, symptoms, treatments, health tips.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || undefined,
    other: {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION || "",
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
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

