import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "../login/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSafeFailureReason(error: unknown): string {
  const err = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = err?.Code || err?.code || err?.name || "UnknownError";
  const status = err?.$metadata?.httpStatusCode;
  const missingVariables = [
    !process.env.R2_ACCOUNT_ID && "R2_ACCOUNT_ID",
    !process.env.R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !process.env.R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
  ].filter(Boolean);

  if (missingVariables.length) {
    return `Missing Vercel environment variable(s): ${missingVariables.join(", ")}.`;
  }
  if (code === "AccessDenied" || status === 403) {
    return "R2 denied the request. Check the token's bucket permissions.";
  }
  if (status === 401 || code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
    return "R2 rejected the configured credentials (HTTP 401). Check that the access key ID and secret are a matching R2 S3 API token pair.";
  }
  if (code === "NoSuchBucket" || status === 404) {
    return "R2 bucket was not found. Check R2_BUCKET_NAME.";
  }
  if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
    return "R2 rejected the configured credentials.";
  }
  if (/timeout|timedout|abort/i.test(code)) {
    return "R2 request timed out. Check connectivity and the Vercel function logs.";
  }
  if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
    return "R2 SDK failed to load in the deployment. Check the Vercel function logs.";
  }

  if (error instanceof Error && error.message) {
    let detail = error.message;
    for (const secret of [process.env.R2_SECRET_ACCESS_KEY, process.env.R2_ACCESS_KEY_ID]) {
      if (secret) detail = detail.replaceAll(secret, "[redacted]");
    }
    detail = detail.replace(/https?:\/\/\S+/g, "[endpoint]").replace(/\s+/g, " ").slice(0, 180);
    return `R2 server error (${code}${status ? `, HTTP ${status}` : ""}): ${detail}`;
  }
  return `R2 server error (${code}${status ? `, HTTP ${status}` : ""}). Check Vercel function logs.`;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin_session")?.value;
    if (!(await validateSession(sessionToken))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { getR2Stats } = await import("@/lib/r2");
    const stats = await getR2Stats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Admin R2 stats error:", error);
    return NextResponse.json(
      {
        status: "Offline",
        error: getSafeFailureReason(error),
      },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  }
}