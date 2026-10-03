export const ARCHIVE_RETENTION_OPTIONS = [
  { days: 1, label: "1 day (24 hours)" },
  { days: 7, label: "Weekly (7 days)" },
  { days: 30, label: "30 days" },
  { days: 90, label: "Quarterly (90 days)" },
  { days: 182, label: "Half yearly (182 days)" },
  { days: 365, label: "Yearly (365 days)" },
] as const;

export const ARCHIVE_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "analytics", label: "Analytics" },
  { value: "ip-security", label: "IP Security" },
  { value: "server-logs", label: "Server Logs" },
] as const;

export type ArchiveCategorySelection = (typeof ARCHIVE_CATEGORY_OPTIONS)[number]["value"];
