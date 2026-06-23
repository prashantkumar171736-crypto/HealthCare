"use client";

import { useState } from "react";

interface LibraryItem {
  type: string;
  slug: string;
  title: string;
  description: string;
  content: string;
}

export default function HealthLibraryClient({ items }: { items: LibraryItem[] }) {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const types = [
    { id: "all", label: "All Resources", icon: "📚" },
    { id: "symptoms", label: "Symptoms Guides", icon: "🤒" },
    { id: "tests", label: "Medical Tests", icon: "🧪" },
    { id: "treatments", label: "Treatment Guides", icon: "💊" },
  ];

  const filteredItems = selectedType === "all" 
    ? items 
    : items.filter(item => item.type === selectedType);

  const toggleExpand = (slug: string) => {
    setExpandedSlug(expandedSlug === slug ? null : slug);
  };

  const getEmojiForType = (type: string) => {
    switch (type) {
      case "symptoms": return "🤒";
      case "tests": return "🧪";
      case "treatments": return "💊";
      default: return "📖";
    }
  };

  return (
    <div className="container" style={{ padding: "3rem 1.5rem" }}>
      <div className="text-center" style={{ marginBottom: "3rem" }}>
        <span className="disease-badge">Educational Resources</span>
        <h1 style={{ marginTop: "0.5rem" }}>Health Library</h1>
        <p className="text-muted" style={{ maxWidth: "600px", margin: "0 auto" }}>
          Explore our medical test explanation guides, symptoms analysis checklists, and clinical treatment primers.
        </p>
      </div>

      {/* Filter Tabs */}
      <div 
        className="flex-center" 
        style={{ 
          flexWrap: "wrap", 
          gap: "0.75rem", 
          marginBottom: "3rem"
        }}
      >
        {types.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedType(type.id);
              setExpandedSlug(null);
            }}
            className="btn btn-secondary btn-sm"
            style={{
              backgroundColor: selectedType === type.id ? "var(--primary-light)" : "",
              color: selectedType === type.id ? "var(--primary)" : "",
              borderColor: selectedType === type.id ? "var(--primary)" : "",
              padding: "0.6rem 1.25rem",
              borderRadius: "var(--radius-lg)"
            }}
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>

      {/* Library Guides Grid */}
      <div className="grid-3">
        {filteredItems.map((item) => {
          const isExpanded = expandedSlug === item.slug;
          return (
            <div 
              key={item.slug} 
              className="library-card"
              style={{
                borderColor: isExpanded ? "var(--primary)" : "",
                boxShadow: isExpanded ? "var(--shadow-lg)" : ""
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="library-card-icon">{getEmojiForType(item.type)}</span>
                <span 
                  className="tag" 
                  style={{ 
                    fontSize: "0.7rem", 
                    textTransform: "uppercase",
                    backgroundColor: "var(--background)",
                    color: "var(--text-muted)",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "var(--radius-sm)"
                  }}
                >
                  {item.type}
                </span>
              </div>
              
              <h3 className="library-card-title" style={{ marginTop: "1rem" }}>{item.title}</h3>
              <p className="library-card-desc" style={{ marginBottom: "1.5rem" }}>
                {item.description}
              </p>

              {isExpanded && (
                <div 
                  style={{ 
                    padding: "1rem 0", 
                    borderTop: "1px solid var(--border)", 
                    marginTop: "1rem",
                    fontSize: "0.95rem",
                    color: "var(--text-main)",
                    lineHeight: "1.6"
                  }}
                >
                  {item.content}
                </div>
              )}

              <button
                onClick={() => toggleExpand(item.slug)}
                className={`btn ${isExpanded ? "btn-secondary" : "btn-primary"} btn-sm`}
                style={{ marginTop: "auto" }}
              >
                {isExpanded ? "Hide Details" : "Read Full Guide"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
