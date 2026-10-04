import test from "node:test";
import assert from "node:assert/strict";

import { buildArchiveWorkbook } from "../src/lib/archive-r2";
import { logServer } from "../src/lib/server-logger";

test("logServer skips persistence when SERVER_LOGGING_ENABLED is false", async () => {
  const previousLoggingSetting = process.env.SERVER_LOGGING_ENABLED;
  const previousMongoUri = process.env.MONGODB_URI;
  const previousConsoleError = console.error;
  let persistenceErrors = 0;

  process.env.SERVER_LOGGING_ENABLED = "false";
  delete process.env.MONGODB_URI;
  console.error = () => {
    persistenceErrors += 1;
  };

  try {
    await logServer({ level: "error", message: "Test log", source: "test" });
    assert.equal(persistenceErrors, 0);
  } finally {
    console.error = previousConsoleError;
    if (previousLoggingSetting === undefined) delete process.env.SERVER_LOGGING_ENABLED;
    else process.env.SERVER_LOGGING_ENABLED = previousLoggingSetting;
    if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongoUri;
  }
});

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
    assert.equal(idHeader.fill.fgColor?.argb, "FF2563EB");
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

test("IP security summary uses IP block and login-attempt fields", () => {
  const rows = [
    {
      _id: "block-1",
      ip: "203.0.113.10",
      ipKey: "fingerprint-1",
      country: "India",
      status: "blocked",
      reason: "failed_admin_login",
      blockedAt: new Date("2026-10-04T08:00:00.000Z"),
      expiresAt: new Date("2026-10-05T08:00:00.000Z"),
      attemptCount: 5,
    },
    {
      _id: "attempt-1",
      ip: "203.0.113.10",
      ipKey: "fingerprint-1",
      country: "India",
      attempts: 2,
      lockedUntil: new Date("2026-10-04T09:00:00.000Z"),
      expiresAt: new Date("2026-10-05T09:00:00.000Z"),
      createdAt: new Date("2026-10-04T08:30:00.000Z"),
      windowStartedAt: new Date("2026-10-04T08:00:00.000Z"),
    },
  ];

  const workbook = buildArchiveWorkbook(rows, "ip-security", {
    category: "ip-security",
    recordsCount: rows.length,
    retentionDays: 7,
    generatedAt: new Date("2026-10-04T09:00:00.000Z"),
  });
  const report = workbook.getWorksheet("Detailed Logs Summary Report");

  assert.ok(report);
  assert.equal(report.getCell("A5").value, "TOTAL RECORDS");
  assert.equal(report.getCell("A6").value, 2);
  assert.equal(report.getCell("C5").value, "UNIQUE IP ADDRESSES");
  assert.equal(report.getCell("C6").value, 1);
  assert.equal(report.getCell("G5").value, "BLOCKED IP RECORDS");
  assert.equal(report.getCell("G6").value, 1);
  assert.equal(report.getCell("I5").value, "LOGIN ATTEMPT RECORDS");
  assert.equal(report.getCell("I6").value, 1);
  assert.equal(report.getCell("K5").value, "RECORDED ATTEMPTS");
  assert.equal(report.getCell("K6").value, 7);
  assert.equal(report.getCell("A8").value, "IP Records by Country");
  assert.equal(report.getCell("A10").value, "Country");
  assert.equal(report.getCell("A11").value, "India");
  assert.equal(report.getCell("B11").value, 2);
});

test("server logs summary uses level, source, method, status, path, and error fields", () => {
  const rows = [
    {
      Time: "2026-10-04 14:35:09",
      Level: "warn",
      Source: "admin.login",
      Method: "POST",
      Path: "/api/admin/login",
      Status: 429,
      Message: "Admin sign-in rejected by active network lock",
      Error: "",
    },
    {
      Time: "2026-10-04 14:36:09",
      Level: "error",
      Source: "admin.archive",
      Method: "GET",
      Path: "/api/admin/archive",
      Status: 500,
      Message: "Archive status fetch failed",
      Error: "MongoServerSelectionError: connection timed out",
    },
    {
      Time: "2026-10-04 14:37:09",
      Level: "info",
      Source: "health.check",
      Method: "GET",
      Path: "/api/health",
      Status: 200,
      Message: "Health check passed",
      Error: "",
    },
  ];

  const workbook = buildArchiveWorkbook(rows, "server-logs", {
    category: "server-logs",
    recordsCount: rows.length,
    retentionDays: 1,
    generatedAt: new Date("2026-10-04T09:00:00.000Z"),
  });
  const report = workbook.getWorksheet("Detailed Logs Summary Report");

  assert.ok(report);
  assert.equal(report.getCell("A5").value, "TOTAL LOG ENTRIES");
  assert.equal(report.getCell("A6").value, 3);
  assert.equal(report.getCell("C5").value, "ERROR LOGS");
  assert.equal(report.getCell("C6").value, 1);
  assert.equal(report.getCell("E5").value, "WARNING LOGS");
  assert.equal(report.getCell("E6").value, 1);
  assert.equal(report.getCell("G5").value, "INFO LOGS");
  assert.equal(report.getCell("G6").value, 1);
  assert.equal(report.getCell("I5").value, "UNIQUE SOURCES");
  assert.equal(report.getCell("I6").value, 3);
  assert.equal(report.getCell("K5").value, "HTTP FAILURES");
  assert.equal(report.getCell("K6").value, 2);
  assert.equal(report.getCell("A8").value, "Logs by Level");
  assert.equal(report.getCell("A10").value, "Level");
  assert.equal(report.getCell("A11").value, "warn");
  assert.equal(report.getCell("H8").value, "Logs by Source");
  assert.equal(report.getCell("H11").value, "admin.login");
});
