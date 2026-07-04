import type { Metadata } from "next";
import FAQClient from "./FAQClient";

const faqs = [
  {
    q: "Is the information on HealthEdu really free?",
    a: "Yes. All articles, symptom guides, and directory resources are 100% free to access. We do not place content behind a paywall, nor do we sell ads or user data."
  },
  {
    q: "Where does the medical information come from?",
    a: "Our educational content is compiled directly from peer-reviewed, authoritative medical institutions such as the World Health Organization (WHO), Mayo Clinic, CDC, and National Institutes of Health (NIH). We translate complex clinical language into understandable formats for general readers."
  },
  {
    q: "How does the optional donation system work?",
    a: "Because we refuse to host distracting advertisements, we rely on donations from readers like you to support web server fees, content production, and site speed optimization. You can donate using UPI, Google Pay, PhonePe, Paytm, or Credit/Debit Cards on our Donate page."
  },
  {
    q: "Can I use this site instead of seeing a doctor?",
    a: "No. The information on this website is for educational purposes only. It is not a substitute for professional medical diagnosis, advice, or treatment. Always consult a physician for any physical or mental health concerns."
  },
  {
    q: "How can I contribute to or suggest new disease pages?",
    a: "We welcome suggestions! If you notice a disease or condition is missing from our directory, feel free to email our medical compiling team at suggestions@healthedu.org."
  },
  {
    q: "Are the donations tax-deductible?",
    a: "HealthEdu is registered as a non-profit educational platform. Depending on your jurisdiction, your donation may be tax-deductible. We provide simulated email receipts upon checkout to verify transactions."
  }
];

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ) | Rog Care Hindi",
  description: "Get answers to frequently asked questions about Rog Care Hindi (HealthEdu), including our editorial process, free medical guides, and non-profit support model.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "Frequently Asked Questions (FAQ) | Rog Care Hindi",
    description: "Get answers to frequently asked questions about Rog Care Hindi (HealthEdu), including our editorial process, free medical guides, and non-profit support model.",
    url: "https://rogcarehindi.vercel.app/faq",
    siteName: "Rog Care Hindi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frequently Asked Questions (FAQ) | Rog Care Hindi",
    description: "Get answers to frequently asked questions about Rog Care Hindi (HealthEdu), including our editorial process, free medical guides, and non-profit support model.",
  },
};

export default function FAQPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FAQClient faqs={faqs} />
    </>
  );
}
