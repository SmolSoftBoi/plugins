export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MonzoClientOptions {
  accessToken: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
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

export class MonzoClient {
  private readonly accessToken: string;
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MonzoClientOptions) {
    this.accessToken = options.accessToken;
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.monzo.com").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<TResponse>(options: MonzoRequestOptions): Promise<TResponse> {
    const method = options.method ?? "GET";
    const url = this.buildUrl(options.path, options.query);
    const headers = new Headers({
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    });

    let body: BodyInit | undefined;
    if (options.form) {
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

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body,
    });

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
