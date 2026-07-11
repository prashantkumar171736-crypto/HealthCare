import type { Metadata } from "next";
import CommentsSection from "./CommentsSection";

export const metadata: Metadata = {
  title: "Community Feedback & Comments | Rog Care Hindi",
  description:
    "Share your thoughts, experiences, and health questions with the Rog Care Hindi community. Read and reply to comments from other users and our team.",
  keywords: [
    "health feedback", "community comments", "patient experiences", "health questions",
    "Rog Care Hindi feedback", "rogcarehindi community", "health discussion",
    "स्वास्थ्य चर्चा", "समुदाय प्रतिक्रिया", "रोग केयर हिंदी",
  ],
  alternates: { canonical: "/feedback" },
  openGraph: {
    title: "Community Feedback & Comments | Rog Care Hindi",
    description:
      "Share your thoughts, experiences, and health questions with the Rog Care Hindi community. Read and reply to comments from other users.",
    url: "https://rogcarehindi.vercel.app/feedback",
    siteName: "Rog Care Hindi",
    type: "website",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "Rog Care Hindi Community" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Community Feedback & Comments | Rog Care Hindi",
    description: "Share your health experiences and questions with the Rog Care Hindi community.",
    images: ["/logo.png"],
  },
};

const discussionForumJsonLd = {
  "@context": "https://schema.org",
  "@type": "DiscussionForumPosting",
  "name": "Rog Care Hindi Community Feedback & Comments",
  "description": "A community forum for health questions, experiences, and feedback on Rog Care Hindi.",
  "url": "https://rogcarehindi.vercel.app/feedback",
  "publisher": {
    "@type": "Organization",
    "name": "Rog Care Hindi",
    "url": "https://rogcarehindi.vercel.app",
    "logo": { "@type": "ImageObject", "url": "https://rogcarehindi.vercel.app/logo.png" },
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://rogcarehindi.vercel.app" },
    { "@type": "ListItem", "position": 2, "name": "Community Feedback", "item": "https://rogcarehindi.vercel.app/feedback" },
  ],
};

export default function FeedbackPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(discussionForumJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="feedback-page">

      {/* Hero Banner */}
      <section className="feedback-hero">
        <div className="container">
          <div className="feedback-hero-inner">
            <div className="feedback-hero-icon">💬</div>
            <h1 className="feedback-hero-title">Community Feedback &amp; Comments</h1>
            <p className="feedback-hero-subtitle">
              Have a question, suggestion, or experience to share? Post your comment below — our
              community and team are here to help.
            </p>
            <a href="#post-comment" className="btn btn-primary feedback-hero-cta">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Write a Comment
            </a>
          </div>
        </div>
      </section>

      {/* Comments Section */}
      <section className="feedback-comments-section">
        <div className="container">
          <CommentsSection />
        </div>
      </section>
    </div>
    </>
  );
}

