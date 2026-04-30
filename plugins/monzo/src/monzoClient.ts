export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MonzoClientOptions {
  accessToken: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export interface MonzoRequestOptions {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  form?: Record<string, string | number | boolean | undefined>;
  json?: unknown;
}

export class MonzoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "MonzoApiError";
  }
}

export class MonzoRequestTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Monzo API request timed out after ${timeoutMs}ms`);
    this.name = "MonzoRequestTimeoutError";
  }
}

export class MonzoClient {
  private readonly accessToken: string;
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  constructor(options: MonzoClientOptions) {
    this.accessToken = options.accessToken;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.monzo.com").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  }

  async request<TResponse>(options: MonzoRequestOptions): Promise<TResponse> {
    const method = options.method ?? "GET";
    const url = this.buildUrl(options.path, options.query);
    const headers = new Headers({
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    });

    if (options.form !== undefined && options.json !== undefined) {
      throw new Error("Monzo request must include either 'form' or 'json', not both.");
    }

    let body: BodyInit | undefined;
    if (options.form !== undefined) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.form)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      body = params;
      headers.set("Content-Type", "application/x-www-form-urlencoded");
    }

    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers.set("Content-Type", "application/json");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new MonzoRequestTimeoutError(this.requestTimeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new MonzoApiError(
        `Monzo API request failed with HTTP ${response.status}`,
        response.status,
        text,
      );
    }

    if (!text) {
      return {} as TResponse;
    }

    return JSON.parse(text) as TResponse;
  }

  private buildUrl(
    path: string,
    query: Record<string, string | number | boolean | undefined> | undefined,
  ): string {
    const url = new URL(path, `${this.apiBaseUrl}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}

export function createMonzoClientFromEnvironment(env: NodeJS.ProcessEnv = process.env): MonzoClient {
  const accessToken = env.MONZO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MONZO_ACCESS_TOKEN is required to call the Monzo API.");
  }

  return new MonzoClient({
    accessToken,
    apiBaseUrl: env.MONZO_API_BASE_URL,
  });
}
