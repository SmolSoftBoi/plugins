import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MonzoApiError, MonzoClient, MonzoRequestTimeoutError } from "../src/monzoClient.js";

const timeoutWatchdogMs = 500;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

async function withWatchdog<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

describe("MonzoClient", () => {
  it("adds bearer auth and query parameters", async () => {
    const requests: Request[] = [];
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        return jsonResponse({ ok: true });
      },
    });

    await client.request({
      path: "/transactions",
      query: {
        account_id: "acc_123",
        limit: 5,
        expand: undefined,
      },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://example.test/transactions?account_id=acc_123&limit=5");
    assert.equal(requests[0].headers.get("Authorization"), "Bearer test-token");
  });

  it("preserves path components in API base URLs", async () => {
    const requests: Request[] = [];
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test/mock/monzo/",
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        return jsonResponse({ ok: true });
      },
    });

    await client.request({
      path: "/transactions",
      query: {
        account_id: "acc_123",
      },
    });

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      "https://example.test/mock/monzo/transactions?account_id=acc_123",
    );
  });

  it("sends form encoded bodies", async () => {
    let request: Request | undefined;
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return jsonResponse({});
      },
    });

    await client.request({
      method: "PUT",
      path: "/pots/pot_123/deposit",
      form: {
        source_account_id: "acc_123",
        amount: 1250,
        dedupe_id: "dedupe-1",
      },
    });

    assert.ok(request);
    assert.equal(request.method, "PUT");
    assert.equal(request.headers.get("Content-Type"), "application/x-www-form-urlencoded");
    assert.equal(await request.text(), "source_account_id=acc_123&amount=1250&dedupe_id=dedupe-1");
  });

  it("sends JSON bodies", async () => {
    let request: Request | undefined;
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return jsonResponse({});
      },
    });

    await client.request({
      method: "PUT",
      path: "/transaction-receipts",
      json: { external_id: "receipt-1" },
    });

    assert.ok(request);
    assert.equal(request.headers.get("Content-Type"), "application/json");
    assert.equal(await request.text(), '{"external_id":"receipt-1"}');
  });

  it("rejects ambiguous form and JSON bodies before fetching", async () => {
    let fetchCalled = false;
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      fetchImpl: async () => {
        fetchCalled = true;
        return jsonResponse({});
      },
    });

    await assert.rejects(
      client.request({
        method: "POST",
        path: "/feed",
        form: { account_id: "acc_123" },
        json: { account_id: "acc_123" },
      }),
      {
        message: "Monzo request must include either 'form' or 'json', not both.",
      },
    );
    assert.equal(fetchCalled, false);
  });

  it("maps non-2xx responses to MonzoApiError", async () => {
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      fetchImpl: async () => new Response('{"error":"invalid_token"}', { status: 401 }),
    });

    await assert.rejects(
      client.request({ path: "/ping/whoami" }),
      (error: unknown) =>
        error instanceof MonzoApiError &&
        error.status === 401 &&
        error.responseBody === '{"error":"invalid_token"}',
    );
  });

  it("maps invalid 2xx JSON responses to MonzoApiError", async () => {
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    });

    await assert.rejects(
      client.request({ path: "/ping/whoami" }),
      (error: unknown) =>
        error instanceof MonzoApiError &&
        error.status === 200 &&
        error.responseBody === "not-json" &&
        error.message === "Monzo API response for HTTP 200 was not valid JSON",
    );
  });

  it("aborts stalled requests after the configured timeout", async () => {
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      requestTimeoutMs: 1,
      fetchImpl: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Request aborted", "AbortError"));
          });
        }),
    });

    await withWatchdog(
      assert.rejects(
        client.request({ path: "/ping/whoami" }),
        (error: unknown) =>
          error instanceof MonzoRequestTimeoutError &&
          error.timeoutMs === 1 &&
          error.message === "Monzo API request timed out after 1ms",
      ),
      timeoutWatchdogMs,
      "Timed out waiting for stalled Monzo request abort.",
    );
  });

  it("aborts stalled response body reads after the configured timeout", async () => {
    const client = new MonzoClient({
      accessToken: "test-token",
      apiBaseUrl: "https://example.test",
      requestTimeoutMs: 1,
      fetchImpl: async (_input, init) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              init?.signal?.addEventListener("abort", () => {
                controller.error(new DOMException("Response body aborted", "AbortError"));
              });
            },
          }),
          { status: 200 },
        ),
    });

    await withWatchdog(
      assert.rejects(
        client.request({ path: "/ping/whoami" }),
        (error: unknown) =>
          error instanceof MonzoRequestTimeoutError &&
          error.timeoutMs === 1 &&
          error.message === "Monzo API request timed out after 1ms",
      ),
      timeoutWatchdogMs,
      "Timed out waiting for stalled Monzo response body abort.",
    );
  });
});
