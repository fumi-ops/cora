import type { RuntimeState, SettingsField } from "../types";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError(0, "Network error.");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getState(): Promise<RuntimeState> {
  return requestJson<RuntimeState>("/api/state");
}

export async function refreshDashboard(payload: {
  sourceId?: string;
  widgetId?: string;
} = {}): Promise<void> {
  await requestJson<{ ok: true }>("/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getSettings(): Promise<{ version: string; fields: SettingsField[] }> {
  return requestJson<{ version: string; fields: SettingsField[] }>("/api/settings");
}

export async function setCredential(key: string, value: string): Promise<void> {
  await requestJson<{ key: string; exists: boolean }>("/api/config/set", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key, value }),
  });
}

export async function patchWidget(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await requestJson<{ ok: true; id: string }>("/api/widget", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id,
      ...patch,
    }),
  });
}

export function subscribeState(
  onMessage: (state: RuntimeState, event: string) => void,
  onError: (error: Event) => void,
): () => void {
  const eventSource = new EventSource("/events");

  const handler = (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as RuntimeState;
    onMessage(payload, event.type);
  };

  eventSource.addEventListener("state", handler as EventListener);
  eventSource.addEventListener("dashboard:update", handler as EventListener);
  eventSource.addEventListener("dashboard:file-change", handler as EventListener);
  eventSource.addEventListener("fetch:start", handler as EventListener);
  eventSource.addEventListener("fetch:end", handler as EventListener);
  eventSource.onerror = onError;

  return () => {
    eventSource.close();
  };
}
