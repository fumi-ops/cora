import type { SourceConfig } from "../types";
import type { Connector } from "./types";

const PLAUSIBLE_API_BASE = "https://plausible.io/api/v1";

function getPlausibleConfig(source: SourceConfig): { apiKey: string; siteId: string; baseUrl: string } {
  const apiKey =
    (source.api_key as string | undefined) ??
    (source.token as string | undefined) ??
    (source.bearer_token as string | undefined);
  const siteId = (source.site_id as string | undefined) ?? (source.siteId as string | undefined);
  const baseUrl = (source.base_url as string | undefined) ?? PLAUSIBLE_API_BASE;

  if (!apiKey) {
    throw new Error(`Source ${source.id} (plausible) is missing \"api_key\".`);
  }

  if (!siteId) {
    throw new Error(`Source ${source.id} (plausible) is missing \"site_id\".`);
  }

  return {
    apiKey,
    siteId,
    baseUrl,
  };
}

async function plausibleRequest(
  source: SourceConfig,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<unknown> {
  const { apiKey, siteId, baseUrl } = getPlausibleConfig(source);
  const query = new URLSearchParams({
    site_id: siteId,
  });

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    query.set(key, String(value));
  }

  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  const url = isAbsolute ? path : `${baseUrl}${path}${path.includes("?") ? "&" : "?"}${query.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  const payload = (await response.json()) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? `Plausible request failed (${response.status})`);
  }

  return payload;
}

function aggregateMetricValue(payload: unknown, key: string): number {
  if (typeof payload !== "object" || payload === null) {
    return 0;
  }

  const results = (payload as { results?: Record<string, unknown> }).results;
  const value = results?.[key];
  if (typeof value === "number") {
    return value;
  }

  return 0;
}

async function visitorsToday(source: SourceConfig): Promise<number> {
  const payload = await plausibleRequest(source, "/stats/aggregate", {
    period: "day",
    metrics: "visitors",
  });

  return aggregateMetricValue(payload, "visitors");
}

async function visitorsMtd(source: SourceConfig): Promise<number> {
  const payload = await plausibleRequest(source, "/stats/aggregate", {
    period: "month",
    metrics: "visitors",
  });

  return aggregateMetricValue(payload, "visitors");
}

async function bounceRate(source: SourceConfig): Promise<{ value: number; unit: string }> {
  const payload = await plausibleRequest(source, "/stats/aggregate", {
    period: "month",
    metrics: "bounce_rate",
  });

  return {
    value: Number(aggregateMetricValue(payload, "bounce_rate").toFixed(2)),
    unit: "%",
  };
}

async function topPages(source: SourceConfig): Promise<Array<{ label: string; value: number }>> {
  const payload = (await plausibleRequest(source, "/stats/breakdown", {
    period: "month",
    property: "event:page",
    metrics: "visitors",
    limit: 10,
  })) as {
    results?: Array<Record<string, unknown>>;
  };

  return (payload.results ?? [])
    .map((row) => {
      const label =
        (row["event:page"] as string | undefined) ??
        (row.page as string | undefined) ??
        (row.label as string | undefined) ??
        "unknown";
      const value =
        (row.visitors as number | undefined) ??
        (row.value as number | undefined) ??
        (row.count as number | undefined) ??
        0;

      return {
        label,
        value,
      };
    })
    .filter((row) => row.label.length > 0);
}

export const plausibleConnector: Connector = {
  type: "plausible",
  namedQueries: {
    visitors_today: visitorsToday,
    visitors_mtd: visitorsMtd,
    top_pages: topPages,
    bounce_rate: bounceRate,
  },
  async execute({ source, query }) {
    if (query.startsWith("/")) {
      return plausibleRequest(source, query);
    }

    if (query.startsWith("http://") || query.startsWith("https://")) {
      return plausibleRequest(source, query);
    }

    throw new Error(
      `Unknown Plausible query \"${query}\". Use a named query or /stats/* API path.`,
    );
  },
};
