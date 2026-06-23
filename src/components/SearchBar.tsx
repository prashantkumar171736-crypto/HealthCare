"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SearchResult {
  name: string;
  slug: string;
  categories: string[];
}

export default function SearchBar({ placeholder = "Search any disease (e.g. Cancer, Asthma, Diabetes)..." }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch results when query changes
  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Failed to fetch search suggestions:", err);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      router.push(`/diseases?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    router.push(`/diseases?search=${encodeURIComponent(example)}`);
  };

  return (
    <div ref={containerRef} className="search-wrapper">
      <form onSubmit={handleSubmit} className="search-input-group">
        <svg className="search-icon" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="20" height="20">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length > 0 && setIsOpen(true)}
        />
        {isLoading && (
          <div style={{ marginRight: "1rem", color: "var(--text-light)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" strokeDasharray="40 20" />
            </svg>
          </div>
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="search-results-dropdown">
          {results.map((result) => (
            <Link
              key={result.slug}
              href={`/diseases/${result.slug}`}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className="search-suggestion-item"
            >
              <span className="search-suggestion-name">{result.name}</span>
              <span className="search-suggestion-category">
                {result.categories && result.categories[0]}
              </span>
            </Link>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.trim() !== "" && !isLoading && (
        <div className="search-results-dropdown" style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.95rem" }}>
          No disease found for &quot;{query}&quot;. Press Enter to view full index.
        </div>
      )}

      <div className="search-examples">
        Try searching:
        <span className="search-example-link" onClick={() => handleExampleClick("Cancer")}>Cancer</span>,
        <span className="search-example-link" onClick={() => handleExampleClick("Heart Attack")}>Heart Attack</span>,
        <span className="search-example-link" onClick={() => handleExampleClick("Diabetes")}>Diabetes</span>,
        <span className="search-example-link" onClick={() => handleExampleClick("Asthma")}>Asthma</span>,
        <span className="search-example-link" onClick={() => handleExampleClick("Dengue")}>Dengue</span>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
