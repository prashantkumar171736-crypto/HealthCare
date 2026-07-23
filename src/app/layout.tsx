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
    // English — Cancer (new article)
    "cancer information", "cancer types", "cancer causes", "cancer treatment",
    "tumor types", "benign tumor", "malignant tumor", "carcinoma", "sarcoma",
    "leukemia", "lymphoma", "melanoma", "multiple myeloma", "brain tumor",
    "breast cancer", "lung cancer", "colorectal cancer", "prostate cancer",
    "cervical cancer", "ovarian cancer", "endometrial cancer", "liver cancer",
    "stomach cancer", "pancreatic cancer", "kidney cancer", "bladder cancer",
    "thyroid cancer", "oral cancer", "esophageal cancer", "skin cancer",
    "metastasis", "angiogenesis", "apoptosis", "oncogenes", "tumor suppressor genes",
    "carcinoma in situ", "osteosarcoma", "Ewing sarcoma", "chondrosarcoma",
    "Hodgkin lymphoma", "Non-Hodgkin lymphoma", "acute leukemia", "chronic leukemia",
    "glioblastoma", "meningioma", "HPV cancer", "UV radiation cancer",
    "cancer staging", "cancer screening", "cancer prevention", "chemotherapy",
    "radiation therapy", "immunotherapy", "cancer biopsy",
    // English — Heart Diseases
    "heart disease", "coronary artery disease", "heart attack", "heart failure",
    "arrhythmia", "hypertension", "congenital heart defects", "valvular heart disease",
    "atrial fibrillation", "blood pressure control", "cardiac symptoms",
    // English — Diabetes
    "diabetes symptoms", "type 1 diabetes", "type 2 diabetes", "gestational diabetes",
    "prediabetes", "diabetic retinopathy", "diabetic nephropathy", "diabetic neuropathy",
    "blood sugar control", "insulin therapy", "blood glucose testing",
    // English — Respiratory
    "respiratory disease", "asthma", "COPD", "pneumonia", "bronchitis",
    "tuberculosis", "pulmonary fibrosis", "influenza", "COVID-19",
    "shortness of breath", "breathing difficulties",
    // English — Infectious
    "malaria", "dengue fever", "HIV AIDS", "hepatitis B", "cholera", "typhoid",
    "infectious disease prevention", "vaccination guide",
    // English — Neurological
    "Alzheimer's disease", "Parkinson's disease", "epilepsy", "stroke",
    "multiple sclerosis", "migraine", "ALS", "amyotrophic lateral sclerosis",
    "Huntington's disease", "neurological disorders",
    // English — Mental Health
    "mental health", "clinical depression", "anxiety disorder", "bipolar disorder",
    "schizophrenia", "PTSD", "ADHD", "OCD", "mindfulness", "meditation",
    "cognitive behavioral therapy", "CBT",
    // English — Skin
    "skin diseases", "eczema", "psoriasis", "acne vulgaris", "dermatitis",
    "vitiligo", "rosacea", "hives", "sunscreen", "skin cancer prevention",
    // English — Kidney
    "kidney disease", "chronic kidney disease", "kidney stones", "acute kidney injury",
    "glomerulonephritis", "polycystic kidney disease", "nephrotic syndrome",
    "urinary tract infection", "dialysis",
    // English — Digestive
    "digestive disorders", "IBS", "GERD", "Crohn's disease", "celiac disease",
    "ulcerative colitis", "peptic ulcer", "gallstones", "abdominal pain",
    // English — Eye
    "eye diseases", "cataracts", "glaucoma", "macular degeneration",
    "conjunctivitis", "dry eye syndrome", "astigmatism", "presbyopia",
    // English — Bone & Joint
    "bone diseases", "osteoporosis", "osteoarthritis", "rheumatoid arthritis",
    "gout", "scoliosis", "fibromyalgia", "Paget's disease",
    // English — Blood Disorders
    "blood disorders", "iron deficiency anemia", "sickle cell anemia",
    "hemophilia", "thalassemia", "DVT", "thrombocytopenia",
    // English — Autoimmune
    "autoimmune diseases", "lupus", "Hashimoto's thyroiditis", "Sjögren's syndrome",
    "Graves' disease", "myasthenia gravis", "scleroderma",
    // English — Rare
    "cystic fibrosis", "rare diseases",
    // English — Health Tips
    "nutrition tips", "whole grains", "healthy fats", "omega-3", "sodium intake",
    "antioxidants", "fitness tips", "walking 10000 steps", "strength training",
    "aerobic exercise", "morning stretching", "sitting hazards",
    "mental wellness", "gratitude journal", "social connections", "digital detox",
    "creative hobbies", "sleep hygiene", "circadian rhythm", "sleep schedule",
    "caffeine cutoff", "disease prevention", "annual health checkup",
    "quit smoking", "handwashing", "sunscreen daily",
    "hydration", "lemon water", "herbal tea", "dehydration signs",
    // English — Library
    "chest pain guide", "fever guide", "headache relief", "fatigue guide",
    "weight loss symptoms", "CBC blood test", "MRI scan", "ECG EKG",
    "blood pressure monitoring", "CT scan", "physical therapy",
    "surgery types", "immunotherapy cancer", "insulin therapy",
    // English — Platform
    "Rog Care Hindi", "rogcarehindi", "free health education", "Hindi health website",
    "health education India", "Indian medical guide", "Ayurveda health",
    "reproductive health", "women health", "men health", "child health",
    "immunity boost", "sexual health education", "hormonal health", "fertility",
    // Hindi — Core
    "रोग केयर हिंदी", "बीमारी के लक्षण", "स्वास्थ्य टिप्स", "रोग का इलाज",
    "बीमारी की जानकारी", "स्वास्थ्य शिक्षा", "हिंदी मेडिकल गाइड", "रोग निदान",
    "घरेलू उपाय", "आयुर्वेदिक उपचार", "बीमारी से बचाव", "स्वस्थ जीवन",
    // Hindi — Cancer
    "कैंसर जानकारी", "कैंसर के लक्षण", "कैंसर का इलाज", "ट्यूमर",
    "कैंसर से बचाव", "ब्रेस्ट कैंसर", "फेफड़े का कैंसर", "ब्लड कैंसर",
    "त्वचा कैंसर", "सर्वाइकल कैंसर", "प्रोस्टेट कैंसर",
    // Hindi — Conditions
    "मधुमेह लक्षण", "हृदय रोग", "श्वास रोग", "त्वचा रोग", "पाचन तंत्र",
    "मानसिक स्वास्थ्य", "महिला स्वास्थ्य", "पुरुष स्वास्थ्य", "बच्चों का स्वास्थ्य",
    "यौन स्वास्थ्य", "प्रजनन स्वास्थ्य", "रोग प्रतिरोधक क्षमता",
    "थायरॉइड", "रक्तचाप", "किडनी रोग", "लिवर रोग",
    "हड्डी रोग", "हार्मोनल स्वास्थ्य",
    "अल्जाइमर", "पार्किंसन", "मिर्गी", "माइग्रेन", "स्ट्रोक",
    "मलेरिया", "डेंगू", "टाइफाइड", "हेपेटाइटिस",
    "अस्थमा", "टीबी", "निमोनिया", "कोरोना",
    "एनीमिया", "सिकल सेल", "ल्यूपस", "आंखों के रोग",
    // Hindi — Health Tips
    "पोषण", "व्यायाम", "नींद", "जलयोजन", "ध्यान", "योग",
    "धूम्रपान छोड़ें", "हाथ धोना", "टीकाकरण", "वार्षिक स्वास्थ्य जांच",
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

