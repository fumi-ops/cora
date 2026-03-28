export function applyJsonPath(input: unknown, pathExpression: string | undefined): unknown {
  if (!pathExpression) {
    return input;
  }

  const trimmed = pathExpression.trim();
  if (!trimmed.startsWith("$") || trimmed === "$") {
    return input;
  }

  const segments = trimmed
    .replace(/^\$\.?/, "")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let current: unknown = input;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
