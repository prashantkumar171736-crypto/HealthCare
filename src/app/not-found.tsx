import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
      <div className="container" style={{ maxWidth: "600px", textAlign: "center" }}>
        
        {/* Animated Icon */}
        <div style={{ fontSize: "5rem", marginBottom: "1.5rem" }}>🔍</div>
        
        {/* Badge */}
        <span className="disease-badge" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)", marginBottom: "1rem" }}>
          Error 404
        </span>

        {/* Title */}
        <h1 style={{ fontSize: "2.75rem", fontWeight: "800", marginBottom: "1rem", color: "var(--text-main)" }}>
          Page Not Found
        </h1>

        {/* Description */}
        <p className="text-muted" style={{ fontSize: "1.1rem", lineHeight: "1.7", marginBottom: "2.5rem" }}>
          We couldn't find the page you were looking for. The link might be broken, or the article may have been moved.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" className="btn btn-primary">
            Go to Homepage
          </Link>
          <Link href="/diseases" className="btn btn-secondary">
            Explore Disease Directory
          </Link>
        </div>

      </div>
    </div>
  );
}
