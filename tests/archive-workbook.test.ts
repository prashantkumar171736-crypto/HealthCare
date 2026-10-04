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

  const analyticsSheet = workbook.getWorksheet("Detailed Logs Summary Report");
  const detailedSheet = workbook.getWorksheet("Logs Report");

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Detailed Logs Summary Report", "Logs Report"],
    "Workbook should contain the detailed summary followed by the raw logs",
  );
  assert.ok(analyticsSheet, "Analytics worksheet should exist");
  assert.ok(detailedSheet, "Detailed Summary worksheet should exist");
  assert.equal(analyticsSheet.getCell("A1").value, "DETAILED LOGS SUMMARY REPORT");
  assert.match(String(analyticsSheet.getCell("A2").value ?? ""), /Window:/);
  assert.equal(detailedSheet.getCell("A1").value, "ID");
  assert.equal(analyticsSheet.getCell("A5").value, "TOTAL RECORDS");
  assert.equal(analyticsSheet.getCell("A6").value, rows.length);
  assert.equal(detailedSheet.getCell("A2").value, "1");
  assert.equal(detailedSheet.getCell("B2").value, "/about");
  assert.equal(detailedSheet.rowCount, rows.length + 1);

  const idHeader = detailedSheet.getCell("A1");
  assert.equal(idHeader.fill.type, "pattern");
  if (idHeader.fill.type === "pattern") {
    assert.equal(idHeader.fill.fgColor.argb, "FF2563EB");
  }
  assert.equal(detailedSheet.getCell("J2").value instanceof Date, true);
  assert.equal(detailedSheet.getCell("J2").numFmt, "yyyy-mm-dd hh:mm:ss");

  for (const category of ["analytics", "ip-security", "server-logs"] as const) {
    const categoryWorkbook = buildArchiveWorkbook(rows, category, {
      category,
      recordsCount: rows.length,
      retentionDays: 7,
      generatedAt: new Date("2026-10-03T03:30:00.000Z"),
    });
    const categoryLogs = categoryWorkbook.getWorksheet("Logs Report");
    assert.ok(categoryLogs);
    assert.equal(categoryLogs.getCell("A1").fill.type, "pattern");
    assert.equal(categoryLogs.getCell("J2").value instanceof Date, true);
    assert.equal(categoryLogs.getCell("J2").numFmt, "yyyy-mm-dd hh:mm:ss");
  }
});
