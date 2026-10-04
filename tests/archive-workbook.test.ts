import test from "node:test";
import assert from "node:assert/strict";

import { buildArchiveWorkbook } from "../src/lib/archive-r2";

test("buildArchiveWorkbook exports an analytics workbook with the reference report design", async () => {
  const rows = [
    {
      _id: "1",
      path: "/about",
      referrer: "Direct",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
      browserLanguage: "en-US",
      sessionId: "session-1",
      country: "India",
      region: "Bihar",
      city: "Patna",
      timestamp: new Date("2026-10-02T10:00:00.000Z"),
    },
    {
      _id: "2",
      path: "/admin/login",
      referrer: "https://example.com",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.0",
      browserLanguage: "en-US",
      sessionId: "session-2",
      country: "United States",
      region: "California",
      city: "Los Angeles",
      timestamp: new Date("2026-10-02T12:00:00.000Z"),
    },
    {
      _id: "3",
      path: "/faq",
      referrer: "Direct",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
      browserLanguage: "en-US",
      sessionId: "session-1",
      country: "India",
      region: "Bihar",
      city: "Patna",
      timestamp: new Date("2026-10-03T03:00:00.000Z"),
    },
  ];

  const workbook = buildArchiveWorkbook(rows, "analytics", {
    category: "analytics",
    recordsCount: rows.length,
    retentionDays: 7,
    generatedAt: new Date("2026-10-03T03:30:00.000Z"),
  });

  const analyticsSheet = workbook.getWorksheet("analytics");
  const detailedSheet = workbook.getWorksheet("Detailed Summary");

  assert.ok(analyticsSheet, "Analytics worksheet should exist");
  assert.ok(detailedSheet, "Detailed Summary worksheet should exist");
  assert.equal(analyticsSheet.getCell("A1").value, "ANALYTICS ARCHIVE - DETAILED SUMMARY");
  assert.match(String(analyticsSheet.getCell("A2").value ?? ""), /Window:/);
  assert.equal(detailedSheet.getCell("A1").value, "ID");
});
