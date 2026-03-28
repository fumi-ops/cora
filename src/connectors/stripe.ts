import type { SourceConfig } from "../types";
import type { Connector } from "./types";

const STRIPE_API_BASE = "https://api.stripe.com";

interface StripeListResponse<T> {
  data: T[];
  has_more: boolean;
}

interface StripePrice {
  unit_amount: number | null;
  recurring?: {
    interval: "day" | "week" | "month" | "year";
    interval_count?: number;
  };
}

interface StripeSubscriptionItem {
  quantity: number;
  price: StripePrice;
}

interface StripeSubscription {
  id: string;
  status: string;
  canceled_at: number | null;
  items: {
    data: StripeSubscriptionItem[];
  };
}

interface StripeCustomer {
  id: string;
}

interface StripeBalanceTransaction {
  amount: number;
}

function getStripeApiKey(source: SourceConfig): string {
  const apiKey =
    (source.api_key as string | undefined) ??
    (source.secret_key as string | undefined) ??
    (source.token as string | undefined);

  if (!apiKey) {
    throw new Error(`Source ${source.id} (stripe) is missing \"api_key\".`);
  }

  return apiKey;
}

function toMonthlyValueCents(price: StripePrice, quantity: number): number {
  const unitAmount = price.unit_amount ?? 0;
  const recurring = price.recurring;
  const interval = recurring?.interval ?? "month";
  const count = recurring?.interval_count ?? 1;
  const total = unitAmount * Math.max(quantity, 1);

  if (interval === "month") {
    return total / count;
  }

  if (interval === "year") {
    return total / (count * 12);
  }

  if (interval === "week") {
    return total * (52 / 12) / count;
  }

  return total * (365 / 12) / count;
}

async function stripeRequest(
  source: SourceConfig,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<unknown> {
  const apiKey = getStripeApiKey(source);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    query.set(key, String(value));
  }

  const url = `${STRIPE_API_BASE}${path}${query.size > 0 ? `?${query.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
  };

  if (!response.ok) {
    const message = payload.error?.message ?? `Stripe request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function listStripeItems<T>(
  source: SourceConfig,
  path: string,
  params: Record<string, string | number | undefined> = {},
  maxPages = 10,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const response = (await stripeRequest(source, path, {
      ...params,
      limit: 100,
      starting_after: cursor,
    })) as StripeListResponse<T>;

    rows.push(...(response.data ?? []));
    if (!response.has_more || response.data.length === 0) {
      break;
    }

    const last = response.data[response.data.length - 1] as { id?: string };
    cursor = last.id;
    if (!cursor) {
      break;
    }
  }

  return rows;
}

function startOfTodayUnix(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(start.getTime() / 1000);
}

function startOfMonthUnix(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return Math.floor(start.getTime() / 1000);
}

async function queryMrr(source: SourceConfig): Promise<{ value: number; unit: string }> {
  const subscriptions = await listStripeItems<StripeSubscription>(source, "/v1/subscriptions", {
    status: "active",
  });

  const mrrCents = subscriptions.reduce((sum, subscription) => {
    const itemTotal = subscription.items.data.reduce((itemSum, item) => {
      return itemSum + toMonthlyValueCents(item.price, item.quantity);
    }, 0);

    return sum + itemTotal;
  }, 0);

  return {
    value: Number((mrrCents / 100).toFixed(2)),
    unit: "$",
  };
}

async function queryArr(source: SourceConfig): Promise<{ value: number; unit: string }> {
  const mrr = await queryMrr(source);
  return {
    value: Number((Number(mrr.value) * 12).toFixed(2)),
    unit: "$",
  };
}

async function queryNewCustomersToday(source: SourceConfig): Promise<number> {
  const customers = await listStripeItems<StripeCustomer>(source, "/v1/customers", {
    "created[gte]": startOfTodayUnix(),
  });

  return customers.length;
}

async function queryRevenueMtd(source: SourceConfig): Promise<{ value: number; unit: string }> {
  const transactions = await listStripeItems<StripeBalanceTransaction>(
    source,
    "/v1/balance_transactions",
    {
      "created[gte]": startOfMonthUnix(),
    },
  );

  const total = transactions.reduce((sum, transaction) => {
    if (transaction.amount <= 0) {
      return sum;
    }
    return sum + transaction.amount;
  }, 0);

  return {
    value: Number((total / 100).toFixed(2)),
    unit: "$",
  };
}

async function queryActiveSubscriptions(source: SourceConfig): Promise<number> {
  const subscriptions = await listStripeItems<StripeSubscription>(source, "/v1/subscriptions", {
    status: "active",
  });

  return subscriptions.length;
}

async function queryChurnRate(source: SourceConfig): Promise<{ value: number; unit: string }> {
  const canceled = await listStripeItems<StripeSubscription>(source, "/v1/subscriptions", {
    status: "canceled",
    "canceled_at[gte]": startOfMonthUnix(),
  });

  const activeCount = await queryActiveSubscriptions(source);
  const churnBase = activeCount + canceled.length;

  const churnRate = churnBase > 0 ? (canceled.length / churnBase) * 100 : 0;
  return {
    value: Number(churnRate.toFixed(2)),
    unit: "%",
  };
}

export const stripeConnector: Connector = {
  type: "stripe",
  namedQueries: {
    mrr: queryMrr,
    arr: queryArr,
    new_customers_today: queryNewCustomersToday,
    revenue_mtd: queryRevenueMtd,
    churn_rate: queryChurnRate,
    active_subscriptions: queryActiveSubscriptions,
  },
  async execute({ source, query }) {
    if (query.startsWith("/")) {
      return stripeRequest(source, query);
    }

    if (query.startsWith("http://") || query.startsWith("https://")) {
      const apiKey = getStripeApiKey(source);
      const response = await fetch(query, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(`Stripe request failed (${response.status})`);
      }

      return payload;
    }

    throw new Error(
      `Unknown Stripe query \"${query}\". Use a named query or a /v1/* API path.`,
    );
  },
};
