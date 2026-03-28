import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { setCredential, hasCredential } from "../runtime/credentials";
import { CoraRuntime } from "../runtime/runtime";
import { embeddedAssets } from "./embedded-assets";

interface ServeOptions {
  port: number;
}

interface RunningServer {
  server: Server;
  stop: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

async function parseBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function serveStatic(assetPath: string): { body: Buffer; contentType: string } | null {
  const normalizedPath = assetPath === "/" ? "/index.html" : assetPath;
  const asset = embeddedAssets[normalizedPath];
  if (!asset) {
    return null;
  }

  return {
    body: Buffer.from(asset.body, "base64"),
    contentType: asset.contentType,
  };
}

export async function startUiServer(runtime: CoraRuntime, options: ServeOptions): Promise<RunningServer> {
  const subscribers = new Set<ServerResponse>();

  const unsubscribe = runtime.subscribe((state, event) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(state)}\n\n`;

    for (const res of subscribers) {
      try {
        if (res.writableEnded || res.destroyed) {
          subscribers.delete(res);
          continue;
        }

        res.write(payload);
      } catch {
        subscribers.delete(res);
      }
    }
  });

  const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if (url.pathname === "/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      });
      response.flushHeaders?.();
      response.write(`event: state\ndata: ${JSON.stringify(runtime.getState())}\n\n`);
      subscribers.add(response);

      const cleanup = () => {
        subscribers.delete(response);
      };

      request.on("close", cleanup);
      response.on("close", cleanup);
      response.on("error", cleanup);
      return;
    }

    if (url.pathname === "/api/state") {
      sendJson(response, runtime.getState());
      return;
    }

    if (url.pathname === "/api/sources") {
      sendJson(response, Object.values(runtime.getState().sourceStatuses));
      return;
    }

    if (url.pathname === "/api/settings") {
      const fields = await runtime.listSettingsFields();
      sendJson(response, {
        version: runtime.version,
        fields,
      });
      return;
    }

    if (url.pathname === "/api/config/set" && request.method === "POST") {
      const body = await parseBody(request);
      const key = typeof body.key === "string" ? body.key : "";
      const value = typeof body.value === "string" ? body.value : "";

      if (!key || !value) {
        sendJson(response, { error: "key and value are required" }, 400);
        return;
      }

      await setCredential(key, value);
      sendJson(response, { key, exists: true });
      return;
    }

    if (url.pathname === "/api/config/get" && request.method === "GET") {
      const key = url.searchParams.get("key") ?? "";
      if (!key) {
        sendJson(response, { error: "key is required" }, 400);
        return;
      }

      sendJson(response, { key, exists: await hasCredential(key) });
      return;
    }

    if (url.pathname === "/refresh" && request.method === "POST") {
      const body = await parseBody(request);
      const sourceId = typeof body.sourceId === "string" ? body.sourceId : undefined;
      const widgetId = typeof body.widgetId === "string" ? body.widgetId : undefined;

      await runtime.refresh({
        force: true,
        sourceId,
        widgetId,
      });

      sendJson(response, { ok: true });
      return;
    }

    if (url.pathname === "/api/widget" && request.method === "POST") {
      const body = await parseBody(request);
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) {
        sendJson(response, { error: "id is required" }, 400);
        return;
      }

      const patch: Record<string, unknown> = { ...body };
      delete patch.id;

      try {
        await runtime.patchWidget(id, patch);
        sendJson(response, { ok: true, id });
      } catch (error) {
        const message = errorMessage(error);
        const status = message.includes("not found") ? 404 : 400;
        sendJson(response, { error: message }, status);
      }
      return;
    }

    const staticResponse = serveStatic(url.pathname);
    if (staticResponse) {
      response.writeHead(200, {
        "Content-Type": staticResponse.contentType,
        "Cache-Control": "no-store",
      });
      response.end(staticResponse.body);
      return;
    }

    response.statusCode = 404;
    response.end("UI assets are not embedded. Run `bun run build:ui` to regenerate embedded assets.");
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      const message = errorMessage(error);

      if (!response.headersSent) {
        sendJson(response, { error: message }, 500);
        return;
      }

      try {
        response.end();
      } catch {
        // Ignore response teardown failures during error handling.
      }
    });
  });

  server.listen(options.port, "127.0.0.1");

  const stop = () => {
    unsubscribe();

    for (const res of subscribers) {
      try {
        res.end();
      } catch {
        // Ignore shutdown races.
      }
    }

    subscribers.clear();
    server.close();
  };

  return { server, stop };
}
