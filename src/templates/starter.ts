import type { CoraConfig, DashboardDocument } from "../types";

export type DashboardTemplateName =
  | "starter"
  | "saas"
  | "ecommerce"
  | "freelancer"
  | "developer";

export interface DashboardTemplateSummary {
  name: DashboardTemplateName;
  description: string;
}

interface DashboardTemplateDefinition {
  name: DashboardTemplateName;
  description: string;
  dashboard: () => DashboardDocument;
  config: () => CoraConfig;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function starterDashboard(): DashboardDocument {
  return {
    title: "My Business",
    updated: nowIso(),
    theme: "dark",
    layout: "auto",
    widgets: [
      {
        id: "mrr",
        type: "metric",
        label: "Monthly Recurring Revenue",
        value: 4200,
        unit: "$",
        trend: "+12%",
        trendLabel: "vs last month",
        status: "good",
      },
      {
        id: "signups",
        type: "timeseries",
        label: "New Signups",
        chartType: "line",
        data: [
          { date: "2026-02-01", value: 23 },
          { date: "2026-02-02", value: 31 },
          { date: "2026-02-03", value: 28 },
        ],
      },
      {
        id: "channel_mix",
        type: "bar",
        label: "Acquisition Channels",
        data: [
          { label: "Organic", value: 64 },
          { label: "Paid", value: 22 },
          { label: "Referral", value: 14 },
        ],
      },
      {
        id: "open_deals",
        type: "table",
        label: "Open Deals",
        columns: ["Name", "Value", "Stage"],
        rows: [["Acme Corp", "$12,000", "Proposal"]],
      },
      {
        id: "agent_summary",
        type: "text",
        label: "Agent Notes",
        content: "3 trials expiring this week. Churn risk: medium.",
      },
    ],
  };
}

export function starterConfig(): CoraConfig {
  return {
    sources: [
      {
        id: "primary_db",
        type: "sqlite",
        path: "./data/app.db",
        refresh: "every 15m",
      },
      {
        id: "status_api",
        type: "http",
        url: "https://api.example.com/metrics",
        api_key: "${STATUS_API_KEY}",
        refresh: "every 1h",
      },
    ],
    widgets: [
      {
        id: "mrr",
        source: "primary_db",
        query: "SELECT SUM(amount) AS value FROM subscriptions WHERE status = 'active'",
      },
      {
        id: "agent_summary",
        source: "status_api",
        query: "$.summary",
      },
    ],
  };
}

function saasDashboard(): DashboardDocument {
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
        value: 0,
        unit: "$",
        status: "neutral",
      },
      {
        id: "arr",
        type: "metric",
        label: "ARR",
        value: 0,
        unit: "$",
        status: "neutral",
      },
      {
        id: "active_subscriptions",
        type: "metric",
        label: "Active Subscriptions",
        value: 0,
        status: "neutral",
      },
      {
        id: "visitors_mtd",
        type: "metric",
        label: "Visitors (MTD)",
        value: 0,
        status: "neutral",
      },
      {
        id: "open_prs",
        type: "metric",
        label: "Open PRs",
        value: 0,
        status: "neutral",
      },
      {
        id: "top_pages",
        type: "bar",
        label: "Top Pages",
        data: [],
      },
      {
        id: "founder_notes",
        type: "text",
        label: "Founder Notes",
        content: "Track churn risks and activation blockers here.",
      },
    ],
  };
}

function saasConfig(): CoraConfig {
  return {
    sources: [
      {
        id: "stripe_main",
        type: "stripe",
        api_key: "${STRIPE_KEY}",
        refresh: "every 1h",
      },
      {
        id: "plausible_main",
        type: "plausible",
        api_key: "${PLAUSIBLE_API_KEY}",
        site_id: "${PLAUSIBLE_SITE_ID}",
        refresh: "every 30m",
      },
      {
        id: "github_repo",
        type: "github",
        token: "${GITHUB_TOKEN}",
        repo: "${GITHUB_REPO}",
        refresh: "every 30m",
      },
    ],
    widgets: [
      { id: "mrr", source: "stripe_main", query: "mrr" },
      { id: "arr", source: "stripe_main", query: "arr" },
      {
        id: "active_subscriptions",
        source: "stripe_main",
        query: "active_subscriptions",
      },
      { id: "visitors_mtd", source: "plausible_main", query: "visitors_mtd" },
      { id: "open_prs", source: "github_repo", query: "open_prs" },
      { id: "top_pages", source: "plausible_main", query: "top_pages" },
    ],
  };
}

function ecommerceDashboard(): DashboardDocument {
  return {
    title: "E-commerce Pulse",
    updated: nowIso(),
    theme: "dark",
    layout: "auto",
    widgets: [
      {
        id: "revenue_mtd",
        type: "metric",
        label: "Revenue (MTD)",
        value: 0,
        unit: "$",
        status: "neutral",
      },
      {
        id: "new_customers_today",
        type: "metric",
        label: "New Customers Today",
        value: 0,
        status: "neutral",
      },
      {
        id: "active_subscriptions",
        type: "metric",
        label: "Active Customers",
        value: 0,
        status: "neutral",
      },
      {
        id: "bounce_rate",
        type: "metric",
        label: "Bounce Rate",
        value: 0,
        unit: "%",
        status: "neutral",
      },
      {
        id: "top_pages",
        type: "table",
        label: "Top Landing Pages",
        columns: ["Page", "Visitors"],
        rows: [],
      },
      {
        id: "ops_summary",
        type: "text",
        label: "Ops Summary",
        content: "Track campaigns, stock risk, and top funnel changes.",
      },
    ],
  };
}

function ecommerceConfig(): CoraConfig {
  return {
    sources: [
      {
        id: "stripe_store",
        type: "stripe",
        api_key: "${STRIPE_KEY}",
        refresh: "every 1h",
      },
      {
        id: "plausible_store",
        type: "plausible",
        api_key: "${PLAUSIBLE_API_KEY}",
        site_id: "${PLAUSIBLE_SITE_ID}",
        refresh: "every 30m",
      },
    ],
    widgets: [
      { id: "revenue_mtd", source: "stripe_store", query: "revenue_mtd" },
      {
        id: "new_customers_today",
        source: "stripe_store",
        query: "new_customers_today",
      },
      {
        id: "active_subscriptions",
        source: "stripe_store",
        query: "active_subscriptions",
      },
      { id: "bounce_rate", source: "plausible_store", query: "bounce_rate" },
      { id: "top_pages", source: "plausible_store", query: "top_pages" },
    ],
  };
}

function freelancerDashboard(): DashboardDocument {
  return {
    title: "Freelancer HQ",
    updated: nowIso(),
    theme: "dark",
    layout: "auto",
    widgets: [
      {
        id: "income_mtd",
        type: "metric",
        label: "Income (MTD)",
        value: 0,
        unit: "$",
        status: "neutral",
      },
      {
        id: "active_clients",
        type: "metric",
        label: "Active Clients",
        value: 0,
        status: "neutral",
      },
      {
        id: "portfolio_stars",
        type: "metric",
        label: "Portfolio Repo Stars",
        value: 0,
        status: "neutral",
      },
      {
        id: "task_mix",
        type: "bar",
        label: "Task Mix",
        data: [],
      },
      {
        id: "pipeline",
        type: "table",
        label: "Client Pipeline",
        columns: ["Client", "Deal Value", "Stage"],
        rows: [],
      },
      {
        id: "notes",
        type: "text",
        label: "Notes",
        content: "Capture blockers, invoicing follow-ups, and weekly priorities.",
      },
    ],
  };
}

function freelancerConfig(): CoraConfig {
  return {
    sources: [
      {
        id: "client_api",
        type: "http",
        url: "https://api.example.com/freelancer",
        api_key: "${FREELANCER_API_KEY}",
        refresh: "every 1h",
      },
      {
        id: "github_portfolio",
        type: "github",
        token: "${GITHUB_TOKEN}",
        repo: "${GITHUB_REPO}",
        refresh: "every 1h",
      },
    ],
    widgets: [
      { id: "income_mtd", source: "client_api", query: "$.income_mtd" },
      { id: "active_clients", source: "client_api", query: "$.active_clients" },
      { id: "task_mix", source: "client_api", query: "$.task_mix" },
      { id: "pipeline", source: "client_api", query: "$.pipeline" },
      { id: "portfolio_stars", source: "github_portfolio", query: "stars" },
    ],
  };
}

function developerDashboard(): DashboardDocument {
  return {
    title: "Developer Ops Board",
    updated: nowIso(),
    theme: "dark",
    layout: "auto",
    widgets: [
      {
        id: "stars",
        type: "metric",
        label: "GitHub Stars",
        value: 0,
        status: "neutral",
      },
      {
        id: "open_issues",
        type: "metric",
        label: "Open Issues",
        value: 0,
        status: "neutral",
      },
      {
        id: "open_prs",
        type: "metric",
        label: "Open PRs",
        value: 0,
        status: "neutral",
      },
      {
        id: "commits_today",
        type: "metric",
        label: "Commits Today",
        value: 0,
        status: "neutral",
      },
      {
        id: "deploys_7d",
        type: "timeseries",
        label: "Deploys (7d)",
        chartType: "line",
        data: [],
      },
      {
        id: "incident_summary",
        type: "text",
        label: "Incident Summary",
        content: "No incidents reported.",
      },
    ],
  };
}

function developerConfig(): CoraConfig {
  return {
    sources: [
      {
        id: "github_main",
        type: "github",
        token: "${GITHUB_TOKEN}",
        repo: "${GITHUB_REPO}",
        refresh: "every 15m",
      },
      {
        id: "ci_api",
        type: "http",
        url: "https://api.example.com/ci",
        api_key: "${CI_API_KEY}",
        refresh: "every 15m",
      },
    ],
    widgets: [
      { id: "stars", source: "github_main", query: "stars" },
      { id: "open_issues", source: "github_main", query: "open_issues" },
      { id: "open_prs", source: "github_main", query: "open_prs" },
      { id: "commits_today", source: "github_main", query: "commits_today" },
      { id: "deploys_7d", source: "ci_api", query: "$.deploys_7d" },
      { id: "incident_summary", source: "ci_api", query: "$.summary" },
    ],
  };
}

const templateDefinitions: Record<DashboardTemplateName, DashboardTemplateDefinition> = {
  starter: {
    name: "starter",
    description: "General-purpose starter with SQLite + HTTP examples.",
    dashboard: starterDashboard,
    config: starterConfig,
  },
  saas: {
    name: "saas",
    description: "Indie SaaS template with Stripe, Plausible, and GitHub metrics.",
    dashboard: saasDashboard,
    config: saasConfig,
  },
  ecommerce: {
    name: "ecommerce",
    description: "E-commerce template focused on revenue, customers, and funnel analytics.",
    dashboard: ecommerceDashboard,
    config: ecommerceConfig,
  },
  freelancer: {
    name: "freelancer",
    description: "Freelancer template for income, client pipeline, and portfolio signals.",
    dashboard: freelancerDashboard,
    config: freelancerConfig,
  },
  developer: {
    name: "developer",
    description: "Developer template with GitHub and CI operations widgets.",
    dashboard: developerDashboard,
    config: developerConfig,
  },
};

const templateAliases: Record<string, DashboardTemplateName> = {
  starter: "starter",
  default: "starter",
  saas: "saas",
  ecommerce: "ecommerce",
  "e-commerce": "ecommerce",
  freelancer: "freelancer",
  developer: "developer",
};

function normalizeTemplateName(input: string | undefined): DashboardTemplateName {
  const normalized = (input ?? "starter").trim().toLowerCase();
  const resolved = templateAliases[normalized];

  if (!resolved) {
    const available = Object.keys(templateDefinitions).join(", ");
    throw new Error(`Unknown template \"${input}\". Available templates: ${available}`);
  }

  return resolved;
}

export function listDashboardTemplates(): DashboardTemplateSummary[] {
  return Object.values(templateDefinitions).map((template) => ({
    name: template.name,
    description: template.description,
  }));
}

export function createTemplateWorkspace(input?: string): {
  templateName: DashboardTemplateName;
  dashboard: DashboardDocument;
  config: CoraConfig;
} {
  const templateName = normalizeTemplateName(input);
  const template = templateDefinitions[templateName];

  return {
    templateName,
    dashboard: template.dashboard(),
    config: template.config(),
  };
}

export function agentInstructionsTemplate(): string {
  return `# CORA_AGENT_INSTRUCTIONS

You are writing updates to \`dashboard.json\` for Cora.

## Rules
- Always keep the top-level structure valid JSON.
- Preserve \`title\`, \`theme\`, \`layout\`, and existing widgets unless explicitly asked to remove them.
- Always update \`updated\` with the current ISO timestamp.
- Update only the widget(s) requested when possible.
- If appending timeseries data, keep existing entries and append new points in \`{ date, value }\` format.

## Annotated dashboard.json schema

\`\`\`json
{
  "title": "My Business",
  "updated": "2026-02-23T10:00:00Z",
  "theme": "dark",
  "layout": "auto",
  "widgets": [
    {
      "id": "mrr",
      "type": "metric",
      "label": "Monthly Recurring Revenue",
      "value": 4200,
      "unit": "$",
      "trend": "+12%",
      "trendLabel": "vs last month",
      "status": "good"
    },
    {
      "id": "signups",
      "type": "timeseries",
      "label": "New Signups",
      "data": [
        { "date": "2026-02-01", "value": 23 },
        { "date": "2026-02-02", "value": 31 }
      ]
    },
    {
      "id": "channel_mix",
      "type": "bar",
      "label": "Acquisition Channels",
      "data": [
        { "label": "Organic", "value": 64 },
        { "label": "Paid", "value": 22 }
      ]
    },
    {
      "id": "open_deals",
      "type": "table",
      "label": "Open Deals",
      "columns": ["Name", "Value", "Stage"],
      "rows": [["Acme Corp", "$12,000", "Proposal"]]
    },
    {
      "id": "agent_summary",
      "type": "text",
      "label": "Agent Notes",
      "content": "3 trials expiring this week."
    }
  ]
}
\`\`\`

Field notes:
- \`updated\` must always be a fresh ISO-8601 timestamp.
- \`widgets[].type\` must be one of: \`metric\`, \`timeseries\`, \`bar\`, \`table\`, \`text\`.
- \`metric.status\` should be \`good\`, \`warning\`, \`critical\`, or \`neutral\`.

## HTTP patch endpoint (optional)
If file I/O is not available, patch one widget directly:

\`\`\`http
POST http://127.0.0.1:4242/api/widget
Content-Type: application/json

{ "id": "mrr", "value": 4800, "trend": "+14%" }
\`\`\`

## Cache invalidation
If you need connectors to re-fetch data, delete \`cora.cache.json\`.
You can also invalidate one source by setting \`cora.cache.json.sources.<source_id>.last_fetched\` to \`1970-01-01T00:00:00.000Z\`.

## Safe update strategy
1. Read current \`dashboard.json\`.
2. Modify only relevant widget objects.
3. Set top-level \`updated\` to the current ISO timestamp.
4. Write valid JSON back to disk.
`;
}
