"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Tracker component tracks visitor page views by sending requests to /api/track.
 * Runs on every client-side route change.
 */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Do not track admin pages, API routes, or standard media assets
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api") ||
      pathname.includes(".")
    ) {
      return;
    }

    const trackView = async () => {
      try {
        await fetch("/api/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: pathname,
            referrer: typeof document !== "undefined" ? document.referrer : "",
          }),
        });
      } catch (err) {
        // Silent failure so tracking doesn't interrupt user experience
        console.warn("Analytics tracking offline:", err);
      }
    };

    trackView();
  }, [pathname]);

  return null;
}
