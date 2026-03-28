import type { IncomingMessage, ServerResponse } from "node:http";

import { defineConfig, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { MockApi, readMockJsonBody } from "./mock-api";

function mockApiPlugin() {
  const api = new MockApi();

  return {
    name: "cora-mock-api",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, response, next) => {
        void handleMockRequest(
          api,
          request as IncomingMessage,
          response as ServerResponse,
          next,
        );
      });
    },
  };
}

async function handleMockRequest(
  api: MockApi,
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");

  if (method === "GET" && url.pathname === "/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    });

    api.subscribe(response);
    return;
  }

  if (method === "GET" && url.pathname === "/api/state") {
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(api.getState()));
    return;
  }

  if (method === "GET" && url.pathname === "/api/settings") {
    const result = await api.getSettings();
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (method === "GET" && url.pathname === "/api/sources") {
    const result = api.getSources();
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (method === "GET" && url.pathname === "/api/config/get") {
    const key = url.searchParams.get("key") ?? "";
    const result = api.getCredentialStatus(key);
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (method === "POST" && url.pathname === "/api/config/set") {
    const body = await readMockJsonBody(request);
    const result = await api.setCredential(body);
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (method === "POST" && url.pathname === "/api/widget") {
    const body = await readMockJsonBody(request);
    const result = await api.patchWidget(body);
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result.body));
    return;
  }

  if (method === "POST" && url.pathname === "/refresh") {
    const body = await readMockJsonBody(request);
    const result = await api.refresh(body);
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result.body));
    return;
  }

  next();
}

export default defineConfig({
  plugins: [tailwindcss(), react(), mockApiPlugin()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
