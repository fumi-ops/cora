const BLOCKED_TAG_PATTERN =
  /<\s*(script|style|iframe|object|embed|form|meta|link|base)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;

const BLOCKED_SELF_CLOSING_TAG_PATTERN =
  /<\s*(script|style|iframe|object|embed|form|meta|link|base)\b[^>]*\/?\s*>/gi;

const INLINE_EVENT_ATTR_PATTERN = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const SRCDOC_ATTR_PATTERN = /\s+srcdoc\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;

const UNSAFE_URL_ATTR_PATTERN =
  /\s+(href|src|action|formaction|xlink:href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function isUnsafeUrl(value: string): boolean {
  const normalized = value.replaceAll(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:text/html")
  );
}

export function sanitizeHtml(input: string): string {
  let output = input;

  output = output.replaceAll(BLOCKED_TAG_PATTERN, "");
  output = output.replaceAll(BLOCKED_SELF_CLOSING_TAG_PATTERN, "");
  output = output.replaceAll(INLINE_EVENT_ATTR_PATTERN, "");
  output = output.replaceAll(SRCDOC_ATTR_PATTERN, "");

  output = output.replaceAll(UNSAFE_URL_ATTR_PATTERN, (match, attrName, rawValue, dqValue, sqValue, bareValue) => {
    const value = dqValue ?? sqValue ?? bareValue ?? "";
    return isUnsafeUrl(value) ? "" : match;
  });

  return output;
}
