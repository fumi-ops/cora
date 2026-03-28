import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  DashboardDocument,
  DashboardWidget,
  RuntimeState,
  SettingsField,
  SourceConfig,
  SourceStatus,
  WidgetBinding,
} from "../src/types";

interface RefreshRequest {
  sourceId?: string;
  widgetId?: string;
}

interface MockResponse<T> {
  body: T;
  status?: number;
}

type Subscriber = {
  response: ServerResponse;
  send: (event: string, state: RuntimeState) => void;
};

const MOCK_VERSION = "dev-mock";

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseRefreshInterval(refresh: string | undefined): number {
  if (!refresh) {
    return 60 * 60_000;
  }

  const match = refresh.match(/(\d+)\s*([mh])/i);
  if (!match) {
    return 60 * 60_000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (unit === "m") {
    return amount * 60_000;
  }

  return amount * 60 * 60_000;
}

function isFresh(
  lastFetched: string | null,
  refresh: string | undefined,
): boolean {
  if (!lastFetched) {
    return false;
  }

  const timestamp = new Date(lastFetched).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= parseRefreshInterval(refresh);
}

function cloneWidget(widget: DashboardWidget): DashboardWidget {
  return structuredClone(widget);
}

function createDashboard(): DashboardDocument {
  return {
    title: "SaaS Control Room",
    updated: nowIso(),
    theme: "dark",
    layout: "auto",
    widgets: [
      {
        id: "mrr",
        type: "metric",
        label: "MRR",
        value: 148_250,
        unit: "$",
        trend: "+12.4%",
        trendLabel: "vs last month",
        status: "good",
      },
      {
        id: "arr",
        type: "metric",
        label: "ARR",
        value: 1_779_000,
        unit: "$",
        trend: "+11.8%",
        trendLabel: "annualized",
        status: "good",
      },
      {
        id: "active_subscriptions",
        type: "metric",
        label: "Active Subscriptions",
        value: 428,
        trend: "+18",
        trendLabel: "net adds this month",
        status: "good",
      },
      {
        id: "visitors_mtd",
        type: "metric",
        label: "Visitors (MTD)",
        value: 48_210,
        trend: "+6.1%",
        trendLabel: "vs previous month",
        status: "neutral",
      },
      {
        id: "open_prs",
        type: "metric",
        label: "Open PRs",
        value: 12,
        trend: "-3",
        trendLabel: "this week",
        status: "warning",
      },
      {
        id: "revenue_trend",
        type: "timeseries",
        label: "Revenue Trend",
        chartType: "area",
        color: "emerald",
        data: [
          { date: "2026-03-21", value: 96 },
          { date: "2026-03-22", value: 104 },
          { date: "2026-03-23", value: 111 },
          { date: "2026-03-24", value: 117 },
          { date: "2026-03-25", value: 121 },
          { date: "2026-03-26", value: 129 },
          { date: "2026-03-27", value: 136 },
        ],
      },
      {
        id: "top_pages",
        type: "bar",
        label: "Top Pages",
        color: "blue",
        data: [
          { label: "Homepage", value: 64 },
          { label: "Docs", value: 52 },
          { label: "Pricing", value: 31 },
          { label: "Blog", value: 18 },
        ],
      },
      {
        id: "open_deals",
        type: "table",
        label: "Open Deals",
        columns: ["Account", "Value", "Stage", "Owner"],
        rows: [
          ["Acme Corp", "$24,000", "Proposal", "Sam"],
          ["Northstar", "$18,500", "Discovery", "Mina"],
          ["Vector Labs", "$9,000", "Negotiation", "Leo"],
        ],
      },
      {
        id: "founder_notes",
        type: "text",
        label: "Founder Notes",
        content:
          "### This week\n- Reduce signup friction in the first-run flow.\n- Watch churn risk in the self-serve cohort.\n- Review the pricing page hierarchy.",
      },
    ],
  };
}

function createSources(): SourceConfig[] {
  return [
    {
      id: "stripe_main",
      type: "stripe",
      refresh: "every 1h",
      api_key: "${STRIPE_KEY}",
    },
    {
      id: "plausible_main",
      type: "plausible",
      refresh: "every 30m",
      api_key: "${PLAUSIBLE_API_KEY}",
      site_id: "${PLAUSIBLE_SITE_ID}",
    },
    {
      id: "github_repo",
      type: "github",
      refresh: "every 30m",
      token: "${GITHUB_TOKEN}",
      repo: "${GITHUB_REPO}",
    },
  ];
}

function createWidgetBindings(): WidgetBinding[] {
  return [
    { id: "mrr", source: "stripe_main", query: "mrr" },
    { id: "arr", source: "stripe_main", query: "arr" },
    {
      id: "active_subscriptions",
      source: "stripe_main",
      query: "active_subscriptions",
    },
    { id: "revenue_trend", source: "stripe_main", query: "revenue_trend" },
    { id: "visitors_mtd", source: "plausible_main", query: "visitors_mtd" },
    { id: "top_pages", source: "plausible_main", query: "top_pages" },
    { id: "open_prs", source: "github_repo", query: "open_prs" },
    { id: "open_deals", source: "github_repo", query: "open_deals" },
    { id: "founder_notes", source: "github_repo", query: "founder_notes" },
  ];
}

function createSettingsFields(): SettingsField[] {
  return [
    { sourceId: "stripe_main", key: "STRIPE_KEY", exists: true },
    { sourceId: "plausible_main", key: "PLAUSIBLE_API_KEY", exists: false },
    { sourceId: "plausible_main", key: "PLAUSIBLE_SITE_ID", exists: false },
    { sourceId: "github_repo", key: "GITHUB_TOKEN", exists: true },
    { sourceId: "github_repo", key: "GITHUB_REPO", exists: false },
  ];
}

function createSourceStatuses(
  sources: SourceConfig[],
): Record<string, SourceStatus> {
  const lastFetchedBySource: Record<string, string> = {
    stripe_main: isoMinutesAgo(8),
    plausible_main: isoMinutesAgo(14),
    github_repo: isoMinutesAgo(41),
  };

  return Object.fromEntries(
    sources.map((source) => {
      const lastFetched = lastFetchedBySource[source.id] ?? null;

      return [
        source.id,
        {
          id: source.id,
          type: source.type,
          refresh: source.refresh ?? "every 1h",
          lastFetched,
          cacheStatus: isFresh(lastFetched, source.refresh) ? "fresh" : "stale",
        } satisfies SourceStatus,
      ];
    }),
  );
}

function createState(): RuntimeState {
  const dashboard = createDashboard();
  const sources = createSources();

  return {
    dashboard,
    widgetErrors: {},
    sourceStatuses: createSourceStatuses(sources),
    sourceByWidget: Object.fromEntries(
      createWidgetBindings().map((binding) => [binding.id, binding.source]),
    ),
    isFetching: false,
    version: MOCK_VERSION,
  };
}

function mutateMetric(
  widget: Extract<DashboardWidget, { type: "metric" }>,
  tick: number,
) {
  if (typeof widget.value !== "number") {
    return widget;
  }

  const delta = Math.max(1, Math.round(widget.value * 0.008)) + tick;
  const direction = widget.id === "open_prs" ? -1 : 1;

  return {
    ...widget,
    value: Math.max(0, widget.value + delta * direction),
  };
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function mutateWidget(widget: DashboardWidget, tick: number): DashboardWidget {
  switch (widget.type) {
    case "metric":
      return mutateMetric(widget, tick);
    case "timeseries": {
      const lastPoint = widget.data[widget.data.length - 1];
      const nextDate = lastPoint
        ? addDays(lastPoint.date, 1)
        : new Date().toISOString().slice(0, 10);
      const base = lastPoint?.value ?? 100;
      return {
        ...widget,
        data: [
          ...widget.data.slice(-6),
          { date: nextDate, value: Math.round(base * (1.01 + tick * 0.01)) },
        ],
      };
    }
    case "bar":
      return {
        ...widget,
        data: widget.data.map((point, index) => ({
          ...point,
          value: Math.max(1, point.value + ((tick + index) % 3) - 1),
        })),
      };
    case "table":
      return {
        ...widget,
        rows:
          widget.rows.length > 1
            ? [...widget.rows.slice(1), widget.rows[0]]
            : widget.rows,
      };
    case "text":
      return {
        ...widget,
        content: `${widget.content}\n\n_Last refreshed in the Vite mock at ${new Date().toLocaleTimeString()}._`,
      };
  }
}

function getAffectedWidgetIds(
  state: RuntimeState,
  request: RefreshRequest,
): Set<string> {
  const sourceByWidget = state.sourceByWidget;

  if (request.widgetId) {
    return new Set([request.widgetId]);
  }

  if (request.sourceId) {
    return new Set(
      Object.entries(sourceByWidget)
        .filter(([, sourceId]) => sourceId === request.sourceId)
        .map(([widgetId]) => widgetId),
    );
  }

  return new Set(state.dashboard.widgets.map((widget) => widget.id));
}

function getAffectedSourceIds(
  state: RuntimeState,
  request: RefreshRequest,
): Set<string> {
  if (request.sourceId) {
    return new Set([request.sourceId]);
  }

  if (request.widgetId) {
    const sourceId = state.sourceByWidget[request.widgetId];
    return sourceId ? new Set([sourceId]) : new Set();
  }

  return new Set(Object.keys(state.sourceStatuses));
}

function createJsonResponse<T>(body: T, status = 200): MockResponse<T> {
  return { body, status };
}

async function readJsonBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

export class MockApi {
  private readonly settingsFields = createSettingsFields();
  private readonly sourceBindings = createWidgetBindings();
  private readonly subscribers = new Set<Subscriber>();
  private readonly credentials = new Map<string, string>();

  private state = createState();
  private refreshTick = 0;

  getState(): RuntimeState {
    return this.state;
  }

  async getSettings(): Promise<
    MockResponse<{ version: string; fields: SettingsField[] }>
  > {
    return createJsonResponse({
      version: MOCK_VERSION,
      fields: this.settingsFields.map((field) => ({
        ...field,
        exists: this.credentials.has(field.key) || field.exists,
      })),
    });
  }

  getSources(): MockResponse<SourceStatus[]> {
    return createJsonResponse(Object.values(this.state.sourceStatuses));
  }

  getCredentialStatus(
    key: string,
  ): MockResponse<{ key: string; exists: boolean }> {
    if (!key) {
      return createJsonResponse({ key, exists: false }, 400);
    }

    return createJsonResponse({
      key,
      exists:
        this.credentials.has(key) ||
        this.settingsFields.some((field) => field.key === key && field.exists),
    });
  }

  async setCredential(
    body: Record<string, unknown>,
  ): Promise<MockResponse<{ key: string; exists: boolean }>> {
    const key = typeof body.key === "string" ? body.key : "";
    const value = typeof body.value === "string" ? body.value : "";

    if (!key || !value) {
      return createJsonResponse({ key, exists: false }, 400);
    }

    this.credentials.set(key, value);
    this.settingsFields.forEach((field) => {
      if (field.key === key) {
        field.exists = true;
      }
    });

    return createJsonResponse({ key, exists: true });
  }

  async patchWidget(
    body: Record<string, unknown>,
  ): Promise<MockResponse<{ ok: true; id: string } | { error: string }>> {
    const widgetId = typeof body.id === "string" ? body.id : "";
    if (!widgetId) {
      return createJsonResponse({ error: "id is required" }, 400);
    }

    const patch: Record<string, unknown> = { ...body };
    delete patch.id;
    delete patch.type;

    if (Object.keys(patch).length === 0) {
      return createJsonResponse({ error: "Widget patch is empty." }, 400);
    }

    const widgetIndex = this.state.dashboard.widgets.findIndex(
      (widget) => widget.id === widgetId,
    );
    if (widgetIndex === -1) {
      return createJsonResponse(
        { error: `Widget ${widgetId} was not found.` },
        404,
      );
    }

    const currentWidget = this.state.dashboard.widgets[
      widgetIndex
    ] as unknown as Record<string, unknown>;
    this.state.dashboard.widgets[widgetIndex] = {
      ...currentWidget,
      ...patch,
    } as unknown as DashboardWidget;
    this.state.dashboard.updated = nowIso();

    this.syncSourceStatuses();
    this.broadcast("dashboard:update");

    return createJsonResponse({ ok: true, id: widgetId });
  }

  async refresh(
    body: Record<string, unknown>,
  ): Promise<MockResponse<{ ok: true }>> {
    const request: RefreshRequest = {
      sourceId: typeof body.sourceId === "string" ? body.sourceId : undefined,
      widgetId: typeof body.widgetId === "string" ? body.widgetId : undefined,
    };

    this.state.isFetching = true;
    this.broadcast("fetch:start");

    try {
      await new Promise((resolve) => setTimeout(resolve, 240));

      const affectedWidgetIds = getAffectedWidgetIds(this.state, request);
      const affectedSourceIds = getAffectedSourceIds(this.state, request);

      this.refreshTick += 1;
      this.state.dashboard.widgets = this.state.dashboard.widgets.map(
        (widget) =>
          affectedWidgetIds.has(widget.id)
            ? mutateWidget(cloneWidget(widget), this.refreshTick)
            : widget,
      );
      this.state.dashboard.updated = nowIso();

      const nextFetched = nowIso();
      for (const sourceId of affectedSourceIds.size > 0
        ? affectedSourceIds
        : Object.keys(this.state.sourceStatuses)) {
        const source = this.state.sourceStatuses[sourceId];
        if (!source) {
          continue;
        }

        source.lastFetched = nextFetched;
        source.cacheStatus = "fresh";
        delete source.error;
      }

      this.syncSourceStatuses();
      this.broadcast("dashboard:update");
    } finally {
      this.state.isFetching = false;
      this.broadcast("fetch:end");
    }

    return createJsonResponse({ ok: true });
  }

  subscribe(response: ServerResponse): void {
    const send = (event: string, state: RuntimeState) => {
      response.write(`event: ${event}\ndata: ${JSON.stringify(state)}\n\n`);
    };

    const subscriber: Subscriber = { response, send };
    this.subscribers.add(subscriber);
    send("state", this.state);

    response.on("close", () => {
      this.subscribers.delete(subscriber);
    });
  }

  private broadcast(event: string): void {
    for (const subscriber of this.subscribers) {
      subscriber.send(event, this.state);
    }
  }

  private syncSourceStatuses(): void {
    const nextStatuses: Record<string, SourceStatus> = {};

    for (const sourceBinding of this.sourceBindings) {
      const source = this.state.sourceStatuses[sourceBinding.source];
      if (!source) {
        continue;
      }

      nextStatuses[source.id] = {
        ...source,
        cacheStatus:
          source.lastFetched && isFresh(source.lastFetched, source.refresh)
            ? "fresh"
            : "stale",
      };
    }

    this.state.sourceStatuses = nextStatuses;
    this.state.sourceByWidget = Object.fromEntries(
      this.sourceBindings.map((binding) => [binding.id, binding.source]),
    );
  }
}

export async function readMockJsonBody(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  return readJsonBody(request);
}
