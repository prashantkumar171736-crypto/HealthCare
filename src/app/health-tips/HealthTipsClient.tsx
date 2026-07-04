"use client";

import { useState } from "react";

interface Tip {
  id: number;
  category: string;
  icon: string;
  title: string;
  body: string;
  tag: string;
  tagColor: string;
}

export default function HealthTipsClient({ tips = [] }: { tips: Tip[] }) {
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = [
    { id: "all", label: "All Tips", icon: "💡" },
    { id: "nutrition", label: "Nutrition", icon: "🥗" },
    { id: "fitness", label: "Fitness", icon: "🏃" },
    { id: "mental", label: "Mental Health", icon: "🧠" },
    { id: "sleep", label: "Sleep", icon: "😴" },
    { id: "prevention", label: "Prevention", icon: "🛡️" },
    { id: "hydration", label: "Hydration", icon: "💧" },
  ];

  const filteredTips =
    activeCategory === "all"
      ? tips
      : tips.filter((t) => t.category === activeCategory);

  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh" }}>
      {/* Hero Banner */}
      <section
        style={{
          background:
            "linear-gradient(135deg, var(--primary-light) 0%, transparent 60%)",
          padding: "4rem 0 3rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="container text-center">
          <span className="disease-badge">Wellness Guide</span>
          <h1
            style={{
              marginTop: "0.75rem",
              fontSize: "3rem",
              marginBottom: "1rem",
            }}
          >
            Health Tips & Wellness
          </h1>
          <p
            className="text-muted"
            style={{ maxWidth: "600px", margin: "0 auto", fontSize: "1.15rem" }}
          >
            Evidence-based lifestyle tips to improve nutrition, fitness, mental
            health, sleep, and disease prevention — curated from WHO, NIH, and
            Mayo Clinic guidelines.
          </p>
        </div>
      </section>

      {/* Category Filter Tabs */}
      <section
        style={{
          padding: "2.5rem 0",
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: "70px",
          zIndex: 10,
        }}
      >
        <div
          className="container flex-center"
          style={{ flexWrap: "wrap", gap: "0.75rem" }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="btn btn-secondary btn-sm"
              style={{
                backgroundColor:
                  activeCategory === cat.id ? "var(--primary)" : "",
                color: activeCategory === cat.id ? "#fff" : "",
                borderColor: activeCategory === cat.id ? "var(--primary)" : "",
                padding: "0.6rem 1.25rem",
                borderRadius: "var(--radius-full)",
                fontWeight: 600,
                transition: "all 0.25s ease",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tips Grid */}
      <section style={{ padding: "4rem 0" }}>
        <div className="container">
          <p
            className="text-muted"
            style={{ marginBottom: "2.5rem", textAlign: "center" }}
          >
            Showing{" "}
            <strong style={{ color: "var(--text-main)" }}>
              {filteredTips.length}
            </strong>{" "}
            health tips
            {activeCategory !== "all" ? (
              <>
                {" "}
                in{" "}
                <strong style={{ color: "var(--primary)" }}>
                  {categories.find((c) => c.id === activeCategory)?.label}
                </strong>
              </>
            ) : (
              ""
            )}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {filteredTips.map((tip) => (
              <div
                key={tip.id}
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xl)",
                  padding: "2rem",
                  boxShadow: "var(--shadow-sm)",
                  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                  cursor: "default",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  borderTop: `4px solid ${tip.tagColor}`,
                }}
                className="health-tip-card"
              >
                {/* Icon & Tag Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "2.5rem" }}>{tip.icon}</span>
                  <span
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      backgroundColor: `${tip.tagColor}18`,
                      color: tip.tagColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {tip.tag}
                  </span>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                    margin: 0,
                  }}
                >
                  {tip.title}
                </h3>

                {/* Body */}
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "var(--text-muted)",
                    lineHeight: "1.7",
                    margin: 0,
                    flexGrow: 1,
                  }}
                >
                  {tip.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          padding: "5rem 0",
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="container text-center" style={{ maxWidth: "700px" }}>
          <span style={{ fontSize: "3rem" }}>❤️</span>
          <h2 style={{ marginTop: "1rem", marginBottom: "1rem" }}>
            Good Health Starts With Small Habits
          </h2>
          <p
            className="text-muted"
            style={{ fontSize: "1.1rem", marginBottom: "2rem" }}
          >
            HealthEdu is committed to providing free, evidence-based health
            education so everyone can make informed choices for a healthier life.
            Support our mission by donating today.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/diseases" className="btn btn-secondary">
              Explore Disease Directory
            </a>
            <a href="/donate" className="btn btn-accent btn-accent-glow">
              Support Us ❤️
            </a>
          </div>
        </div>
      </section>

      <style>{`
        .health-tip-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
        @media (max-width: 768px) {
          [style*="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))"] {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
