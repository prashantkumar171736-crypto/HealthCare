import { createHash } from "node:crypto";
import { after } from "next/server";
import { getDb } from "@/lib/db";

type ServerLogLevel = "info" | "warn" | "error";

interface ServerLogInput {
  level: ServerLogLevel;
  message: string;
  source: string;
  path?: string;
  method?: string;
  statusCode?: number;
  error?: unknown;
  meta?: Record<string, unknown>;
  sessionId?: string;
}

const SENSITIVE_KEY = /password|passwd|token|otp|authorization|cookie|api.?key|secret|credential|email|phone|request.?body|user.?data|user.?name|user.?id|session|ip.?address/i;
const SENSITIVE_ASSIGNMENT = /((?:"?[\w.-]*(?:password|passwd|token|otp|authorization|cookie|api[_-]?key|secret|credential)[\w.-]*"?)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

function redactString(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/((?:authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*/gi, "$1[REDACTED]")
    .replace(/\b(mongodb(?:\+srv)?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(SENSITIVE_ASSIGNMENT, "$1[REDACTED]");
}

function sanitizeMetaValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value).slice(0, 300);
  if (value instanceof Date) return value.toISOString();
  if (depth >= 3 || typeof value !== "object") return undefined;

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeMetaValue(item, depth + 1)).filter((item) => item !== undefined);
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const sanitized = sanitizeMetaValue(item, depth + 1);
    if (sanitized !== undefined) output[key.slice(0, 80)] = sanitized;
  }
  return output;
}

function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const sanitized = sanitizeMetaValue(meta);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) return undefined;
  return Buffer.byteLength(JSON.stringify(sanitized), "utf8") <= 2048
    ? sanitized as Record<string, unknown>
    : { truncated: true };
}

function getErrorFields(error: unknown) {
  if (!error) return { errorName: undefined, errorMessage: undefined, errorStack: undefined };
  if (error instanceof Error) {
    return {
      errorName: redactString(error.name).slice(0, 200),
      errorMessage: redactString(error.message).slice(0, 1000),
      errorStack: error.stack ? redactString(error.stack).slice(0, 4000) : undefined,
    };
  }
  const message = typeof error === "string" ? error : "Unexpected server error";
  return { errorName: "Error", errorMessage: redactString(message).slice(0, 1000), errorStack: undefined };
}

async function persistServerLog(document: Record<string, unknown>): Promise<void> {
  try {
    const db = await getDb();
    await db.collection("server_logs").insertOne(document);
  } catch (error) {
    const failure = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown database error";
    console.error("Server log persistence failed:", redactString(failure).slice(0, 500));
  }
}

export async function logServer(input: ServerLogInput): Promise<void> {
  if (process.env.SERVER_LOGGING_ENABLED?.trim().toLowerCase() === "false") return;

  const errorFields = getErrorFields(input.error);
  const sessionId = input.sessionId?.trim();
  const document = {
    level: input.level,
    message: redactString(input.message).slice(0, 1000),
    source: redactString(input.source).slice(0, 200),
    path: input.path ? redactString(input.path.split("?", 1)[0]).slice(0, 500) : undefined,
    method: input.method?.slice(0, 20),
    statusCode: input.statusCode,
    ...errorFields,
    meta: sanitizeMeta(input.meta),
    sessionId: sessionId ? createHash("sha256").update(sessionId).digest("hex") : undefined,
    env: process.env.VERCEL_ENV || "development",
    createdAt: new Date(),
  };

  try {
    after(() => persistServerLog(document));
  } catch {
    await persistServerLog(document);
  }
}