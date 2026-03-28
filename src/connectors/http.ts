import type { Connector } from "./types";

interface HttpConnectorResult {
  data: unknown;
  status: number;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const httpConnector: Connector = {
  type: "http",
  async execute({ source, query }): Promise<HttpConnectorResult> {
    const sourceUrl = source.url as string | undefined;
    if (!sourceUrl) {
      throw new Error(`Source ${source.id} (http) is missing \"url\".`);
    }

    const method = (source.method as string | undefined) ?? "GET";
    const requestUrl = /^https?:\/\//i.test(query) ? query : sourceUrl;

    const headers: Record<string, string> = {};

    if (typeof source.api_key === "string") {
      const headerName = (source.api_key_header as string | undefined) ?? "Authorization";
      headers[headerName] = headerName === "Authorization" ? `Bearer ${source.api_key}` : source.api_key;
    }

    if (typeof source.headers === "object" && source.headers !== null) {
      Object.assign(headers, source.headers as Record<string, string>);
    }

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method,
        headers,
      });
    } catch {
      throw new HttpError(0, `Network error while calling ${requestUrl}.`);
    }

    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, `HTTP ${response.status} from ${requestUrl}: ${text.slice(0, 200)}`);
    }

    let data: unknown;
    try {
      data = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return {
      data,
      status: response.status,
    };
  },
};
