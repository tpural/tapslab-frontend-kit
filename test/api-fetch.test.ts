import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "../src/lib/api-fetch";

/** Narrows the rejection so assertions do not fight `unknown`. */
async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the promise to reject");
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("unwraps the envelope and returns data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true, data: { id: "1" } })));
    await expect(apiFetch<{ id: string }>("/api/items")).resolves.toEqual({ id: "1" });
  });

  it("throws ApiError carrying the code and field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            error: { code: "validation_failed", message: "Bad", fields: { title: "Required" } },
          },
          422,
        ),
      ),
    );

    const error = await rejection(apiFetch("/api/items"));
    expect(error.code).toBe("validation_failed");
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({ title: "Required" });
  });

  it("returns undefined for 204 without trying to parse a body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(apiFetch("/api/items/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  // A proxy 502 returns HTML. Reporting the status beats a JSON parse error.
  it("reports the status when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })),
    );
    const error = await rejection(apiFetch("/api/items"));
    expect(error.status).toBe(502);
    expect(error.message).toContain("502");
  });

  it("reports a network failure rather than leaking the fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const error = await rejection(apiFetch("/api/items"));
    expect(error.code).toBe("network");
  });

  it("aborts once the timeout elapses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );

    const error = await rejection(apiFetch("/api/slow", { timeoutMs: 10 }));
    expect(error.message).toMatch(/timed out/);
  });

  it("sends JSON with the right content-type", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ ok: true, data: null }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/items", { method: "POST", json: { title: "A" } });

    const init = fetchMock.mock.calls[0]![1];
    expect(init.body).toBe('{"title":"A"}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });
});

describe("caller-supplied abort signals", () => {
  it("does not issue the request when the signal is already aborted", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const controller = new AbortController();
    controller.abort();

    await expect(apiFetch("/items", { signal: controller.signal })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves no listener behind on the normal path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: true, data: { id: 1 } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const controller = new AbortController();
    const added: string[] = [];
    const original = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.removeEventListener = (...args: Parameters<typeof original>) => {
      added.push("removed");
      return original(...args);
    };

    await apiFetch("/items", { signal: controller.signal });
    expect(added).toContain("removed");
  });
});
