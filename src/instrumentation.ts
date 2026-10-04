import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { logServer } = await import("@/lib/server-logger");
  await logServer({
    level: "error",
    message: "Unhandled server request error",
    source: context.routePath,
    path: request.path,
    method: request.method,
    error,
    meta: {
      routerKind: context.routerKind,
      routeType: context.routeType,
      digest: error && typeof error === "object" && "digest" in error
        ? String(error.digest)
        : undefined,
    },
  });
};