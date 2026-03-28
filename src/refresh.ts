const REFRESH_PATTERN = /^every\s+(\d+)\s*([mhd])$/i;

const UNIT_TO_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export const DEFAULT_REFRESH_MS = 5 * 60_000;
export const MIN_REFRESH_MS = 60_000;

export function parseRefreshInterval(input?: string): number {
  if (!input) {
    return DEFAULT_REFRESH_MS;
  }

  const trimmed = input.trim();
  const match = trimmed.match(REFRESH_PATTERN);

  if (!match) {
    throw new Error(`Invalid refresh value \"${input}\". Use format like \"every 5m\" or \"every 1h\".`);
  }

  const [, countRaw, unitRaw] = match;
  const count = Number.parseInt(countRaw, 10);
  const unit = unitRaw.toLowerCase();

  const ms = count * UNIT_TO_MS[unit];
  if (ms < MIN_REFRESH_MS) {
    throw new Error(`Refresh interval \"${input}\" is below the minimum of 1 minute.`);
  }

  return ms;
}

export function toHumanDuration(ms: number): string {
  if (ms % 86_400_000 === 0) {
    return `every ${ms / 86_400_000}d`;
  }
  if (ms % 3_600_000 === 0) {
    return `every ${ms / 3_600_000}h`;
  }
  return `every ${ms / 60_000}m`;
}

export function isFresh(lastFetchedIso: string | null | undefined, refreshMs: number): boolean {
  if (!lastFetchedIso) {
    return false;
  }

  const ts = Date.parse(lastFetchedIso);
  if (Number.isNaN(ts)) {
    return false;
  }

  return Date.now() - ts < refreshMs;
}
