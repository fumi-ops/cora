import type { SourceConfig } from "../types";
import type { Connector } from "./types";

const GITHUB_API_BASE = "https://api.github.com";

function getGithubConfig(source: SourceConfig): { token: string; repo: string; baseUrl: string } {
  const token =
    (source.api_key as string | undefined) ??
    (source.token as string | undefined) ??
    (source.pat as string | undefined);
  const repo = (source.repo as string | undefined) ?? (source.repository as string | undefined);
  const baseUrl = (source.base_url as string | undefined) ?? GITHUB_API_BASE;

  if (!token) {
    throw new Error(`Source ${source.id} (github) is missing \"token\" or \"api_key\".`);
  }

  if (!repo) {
    throw new Error(`Source ${source.id} (github) is missing \"repo\" (owner/repo).`);
  }

  return {
    token,
    repo,
    baseUrl,
  };
}

async function githubRequest(
  source: SourceConfig,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<unknown> {
  const { token, baseUrl } = getGithubConfig(source);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    query.set(key, String(value));
  }

  const isAbsolute = path.startsWith("http://") || path.startsWith("https://");
  const url = isAbsolute
    ? path
    : `${baseUrl}${path}${query.size > 0 ? `${path.includes("?") ? "&" : "?"}${query.toString()}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cora",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    const message =
      (payload as { message?: string }).message ?? `GitHub request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function repoPath(source: SourceConfig): string {
  const { repo } = getGithubConfig(source);
  return `/repos/${repo}`;
}

async function stars(source: SourceConfig): Promise<number> {
  const payload = (await githubRequest(source, repoPath(source))) as {
    stargazers_count?: number;
  };

  return payload.stargazers_count ?? 0;
}

async function openIssues(source: SourceConfig): Promise<number> {
  const { repo } = getGithubConfig(source);
  const query = `repo:${repo} is:issue is:open`;
  const payload = (await githubRequest(source, "/search/issues", {
    q: query,
    per_page: 1,
  })) as {
    total_count?: number;
  };

  return payload.total_count ?? 0;
}

async function openPrs(source: SourceConfig): Promise<number> {
  const { repo } = getGithubConfig(source);
  const query = `repo:${repo} is:pr is:open`;
  const payload = (await githubRequest(source, "/search/issues", {
    q: query,
    per_page: 1,
  })) as {
    total_count?: number;
  };

  return payload.total_count ?? 0;
}

function startOfTodayIso(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

async function commitsToday(source: SourceConfig): Promise<number> {
  const payload = (await githubRequest(source, `${repoPath(source)}/commits`, {
    since: startOfTodayIso(),
    per_page: 100,
  })) as unknown[];

  return Array.isArray(payload) ? payload.length : 0;
}

export const githubConnector: Connector = {
  type: "github",
  namedQueries: {
    stars,
    open_issues: openIssues,
    open_prs: openPrs,
    commits_today: commitsToday,
  },
  async execute({ source, query }) {
    if (query.startsWith("/")) {
      return githubRequest(source, query);
    }

    if (query.startsWith("http://") || query.startsWith("https://")) {
      return githubRequest(source, query);
    }

    throw new Error(
      `Unknown GitHub query \"${query}\". Use a named query or /repos/* API path.`,
    );
  },
};
