import type { Metadata } from "next";
import CommentsSection from "./CommentsSection";

export const metadata: Metadata = {
  title: "Community Feedback & Comments | HealthEdu",
  description:
    "Share your thoughts, questions, and feedback with the HealthEdu community. Read and reply to comments from other users.",
  alternates: {
    canonical: "/feedback",
  },
};

export default function FeedbackPage() {
  return (
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
  );
}
