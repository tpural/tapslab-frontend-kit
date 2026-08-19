import type { ApiResponse, ErrorCode } from "@tpural/backend-kit/http";

/**
 * Envelope types are imported from @tpural/backend-kit rather than redeclared,
 * so the contract has one definition. Type-only, so nothing reaches the bundle.
 */
export class ApiError extends Error {
  readonly code: ErrorCode | "network";
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: ErrorCode | "network",
    message: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Serialised as JSON with the right content-type. */
  json?: unknown;
  /** Abort after this many ms. Defaults to 30s. */
  timeoutMs?: number;
};

/**
 * Returns `data` directly, throws ApiError otherwise. Small because most data
 * is loaded in Server Components and never touches it.
 */
export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, timeoutMs = 30_000, headers, signal, ...rest } = options;

  // A caller who aborted before we were called has already asked for nothing
  // to happen. addEventListener alone would miss this: the abort event fired
  // before the listener existed, so the request would go out regardless.
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");

  // A fetch with no timeout hangs until the browser gives up -- minutes, with
  // no way for the UI to recover.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  } catch (error) {
    // A caller-initiated abort is not a failure to report as one.
    if (signal?.aborted) throw error;
    const timedOut = controller.signal.aborted;
    throw new ApiError(
      "network",
      timedOut ? "The request timed out" : "Could not reach the server",
      0,
    );
  } finally {
    clearTimeout(timer);
    // Removed explicitly, not left to `once`: on the normal path it never
    // fires, and a signal that outlives one request would otherwise collect a
    // listener per call.
    signal?.removeEventListener("abort", onCallerAbort);
  }

  if (response.status === 204) return undefined as T;

  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    // Something upstream answered instead of the app (proxy 502, HTML error
    // page); the status is more useful than a parse error.
    throw new ApiError("internal", `Unexpected response (HTTP ${response.status})`, response.status);
  }

  if (!body.ok) {
    throw new ApiError(body.error.code, body.error.message, response.status, body.error.fields);
  }

  return body.data;
}

export const api = {
  get: <T>(url: string, options?: ApiFetchOptions) => apiFetch<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string, json?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(url, { ...options, method: "POST", json }),
  patch: <T>(url: string, json?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(url, { ...options, method: "PATCH", json }),
  delete: <T>(url: string, options?: ApiFetchOptions) =>
    apiFetch<T>(url, { ...options, method: "DELETE" }),
};
