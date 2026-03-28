import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";

import { executeConnector } from "../connectors";
import { parseRefreshInterval, toHumanDuration, isFresh } from "../refresh";
import type {
  CacheFile,
  CoraConfig,
  DashboardDocument,
  RuntimeState,
  SettingsField,
  SourceConfig,
  SourceStatus,
  WorkspacePaths,
} from "../types";
import {
  loadProjectEnv,
  readCache,
  readConfig,
  readDashboard,
  writeCache,
  writeDashboard,
} from "../workspace";
import {
  extractCredentialKeysFromSource,
  resolveSourceCredentials,
} from "./credential-resolution";
import { hasCredential } from "./credentials";
import { applyWidgetResult } from "./widget-updates";

interface RuntimeOptions {
  paths: WorkspacePaths;
  version: string;
}

interface RefreshRequest {
  force?: boolean;
  sourceId?: string;
  widgetId?: string;
}

interface RuntimeSubscriber {
  (state: RuntimeState, event: string): void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export class CoraRuntime {
  readonly paths: WorkspacePaths;
  readonly version: string;

  dashboard!: DashboardDocument;
  config!: CoraConfig;
  cache!: CacheFile;

  isFetching = false;
  widgetErrors: Record<string, string> = {};
  sourceStatuses: Record<string, SourceStatus> = {};
  sourceByWidget: Record<string, string> = {};

  private schedulerTimer: Timer | null = null;
  private dashboardWatcher: FSWatcher | null = null;
  private subscribers = new Set<RuntimeSubscriber>();
  private inFlightRefresh: Promise<void> | null = null;
  private sourceErrors: Record<string, string> = {};

  constructor(options: RuntimeOptions) {
    this.paths = options.paths;
    this.version = options.version;
  }

  async initialize(fetchOnStart: boolean): Promise<void> {
    await this.reloadFromDisk();
    this.startDashboardWatcher();
    this.startScheduler();

    if (fetchOnStart) {
      await this.refresh({ force: false });
    }

    this.notify("ready");
  }

  async reloadFromDisk(): Promise<void> {
    this.dashboard = await readDashboard(this.paths);
    this.config = await readConfig(this.paths);
    this.cache = await readCache(this.paths);
    this.buildSourceMap();
    this.recomputeSourceStatuses();
  }

  dispose(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.dashboardWatcher) {
      this.dashboardWatcher.close();
      this.dashboardWatcher = null;
    }
  }

  subscribe(subscriber: RuntimeSubscriber): () => void {
    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  getState(): RuntimeState {
    return {
      dashboard: this.dashboard,
      widgetErrors: this.widgetErrors,
      sourceStatuses: this.sourceStatuses,
      sourceByWidget: this.sourceByWidget,
      isFetching: this.isFetching,
      version: this.version,
    };
  }

  async refresh(request: RefreshRequest = {}): Promise<void> {
    const isBackgroundRefresh =
      request.force !== true &&
      request.sourceId === undefined &&
      request.widgetId === undefined;

    while (this.inFlightRefresh) {
      if (isBackgroundRefresh) {
        await this.inFlightRefresh;
        return;
      }

      await this.inFlightRefresh;
    }

    const currentRefresh = this.executeRefresh(request);
    this.inFlightRefresh = currentRefresh;

    try {
      await currentRefresh;
    } finally {
      if (this.inFlightRefresh === currentRefresh) {
        this.inFlightRefresh = null;
      }
    }
  }

  private async executeRefresh(request: RefreshRequest): Promise<void> {
    const { force = true, sourceId, widgetId } = request;

    this.isFetching = true;
    this.notify("fetch:start");

    try {
      await this.reloadFromDisk();

      const envMap = await loadProjectEnv(this.paths);

      const targetBindings = this.config.widgets.filter((binding) => {
        if (widgetId && binding.id !== widgetId) {
          return false;
        }

        if (sourceId && binding.source !== sourceId) {
          return false;
        }

        return true;
      });

      const bindingsBySource = new Map<string, typeof targetBindings>();
      for (const binding of targetBindings) {
        const existing = bindingsBySource.get(binding.source) ?? [];
        existing.push(binding);
        bindingsBySource.set(binding.source, existing);
      }

      let hasChanges = false;

      for (const source of this.config.sources) {
        if (sourceId && source.id !== sourceId) {
          continue;
        }

        const bindings = bindingsBySource.get(source.id) ?? [];
        if (bindings.length === 0) {
          continue;
        }

        const refreshMs = parseRefreshInterval(source.refresh);
        const cacheEntry = this.cache.sources[source.id];
        const fresh = isFresh(cacheEntry?.last_fetched, refreshMs);

        if (!force && fresh) {
          continue;
        }

        const refreshLabel = toHumanDuration(refreshMs);

        try {
          const resolvedSource = await resolveSourceCredentials(source, {
            projectEnv: envMap,
          });

          const results = await Promise.allSettled(
            bindings.map(async (binding) => {
              const result = await executeConnector(
                resolvedSource,
                binding.query,
                binding.jsonPath,
                this.paths.rootDir,
              );
              return {
                binding,
                result,
              };
            }),
          );

          let successfulBindings = 0;
          let failedBindings = 0;
          const failureMessages: string[] = [];

          for (const [index, outcome] of results.entries()) {
            const binding = bindings[index];

            if (outcome.status === "rejected") {
              const message = errorMessage(outcome.reason);
              this.widgetErrors[binding.id] = message;
              failedBindings += 1;
              failureMessages.push(`${binding.id}: ${message}`);
              continue;
            }

            const { result } = outcome.value;
            const widgetIndex = this.dashboard.widgets.findIndex((widget) => widget.id === binding.id);
            if (widgetIndex === -1) {
              this.widgetErrors[binding.id] = `Widget ${binding.id} is referenced in cora.config.yaml but missing from dashboard.json.`;
              failedBindings += 1;
              failureMessages.push(
                `${binding.id}: Widget ${binding.id} is referenced in cora.config.yaml but missing from dashboard.json.`,
              );
              continue;
            }

            const originalWidget = this.dashboard.widgets[widgetIndex];
            const updatedWidget = applyWidgetResult(originalWidget, result);
            updatedWidget.source = source.id;
            this.dashboard.widgets[widgetIndex] = updatedWidget;

            delete this.widgetErrors[binding.id];
            hasChanges = true;
            successfulBindings += 1;
          }

          if (successfulBindings > 0) {
            this.cache.sources[source.id] = {
              last_fetched: new Date().toISOString(),
            };
          }

          let sourceError: string | undefined;
          let sourceCacheStatus: SourceStatus["cacheStatus"] = "fresh";
          if (failedBindings > 0) {
            sourceError = failureMessages.join(" | ");
            if (successfulBindings === 0) {
              sourceCacheStatus = this.cache.sources[source.id] ? "stale" : "missing";
            }
          }

          if (sourceError) {
            this.sourceErrors[source.id] = sourceError;
          } else {
            delete this.sourceErrors[source.id];
          }

          this.sourceStatuses[source.id] = {
            id: source.id,
            type: source.type,
            refresh: refreshLabel,
            lastFetched: this.cache.sources[source.id]?.last_fetched ?? null,
            cacheStatus: sourceCacheStatus,
            error: sourceError,
          };
        } catch (error) {
          const message = errorMessage(error);

          for (const binding of bindings) {
            this.widgetErrors[binding.id] = message;
          }

          this.sourceErrors[source.id] = message;
          this.sourceStatuses[source.id] = {
            id: source.id,
            type: source.type,
            refresh: refreshLabel,
            lastFetched: this.cache.sources[source.id]?.last_fetched ?? null,
            cacheStatus: this.cache.sources[source.id] ? "stale" : "missing",
            error: message,
          };
        }
      }

      if (hasChanges || force) {
        this.dashboard.updated = new Date().toISOString();
        await writeDashboard(this.paths, this.dashboard);
      }

      await writeCache(this.paths, this.cache);
      this.recomputeSourceStatuses();
      this.notify("dashboard:update");
    } finally {
      this.isFetching = false;
      this.notify("fetch:end");
    }
  }

  async patchWidget(widgetId: string, patch: Record<string, unknown>): Promise<void> {
    await this.reloadFromDisk();

    const widgetIndex = this.dashboard.widgets.findIndex((widget) => widget.id === widgetId);
    if (widgetIndex === -1) {
      throw new Error(`Widget ${widgetId} was not found.`);
    }

    const currentWidget = this.dashboard.widgets[widgetIndex] as unknown as Record<string, unknown>;
    const sanitizedPatch: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(patch)) {
      if (key === "id" || key === "type") {
        continue;
      }

      sanitizedPatch[key] = value;
    }

    if (Object.keys(sanitizedPatch).length === 0) {
      throw new Error("Widget patch is empty.");
    }

    this.dashboard.widgets[widgetIndex] = {
      ...currentWidget,
      ...sanitizedPatch,
    } as unknown as (typeof this.dashboard.widgets)[number];
    this.dashboard.updated = new Date().toISOString();

    await writeDashboard(this.paths, this.dashboard);
    this.notify("dashboard:update");
  }

  async listSettingsFields(): Promise<SettingsField[]> {
    await this.reloadFromDisk();

    const out: SettingsField[] = [];

    for (const source of this.config.sources) {
      const keys = extractCredentialKeysFromSource(source);
      for (const key of keys) {
        out.push({
          sourceId: source.id,
          key,
          exists: await hasCredential(key),
        });
      }
    }

    return out;
  }

  private notify(event: string): void {
    const state = this.getState();
    for (const subscriber of this.subscribers) {
      subscriber(state, event);
    }
  }

  private recomputeSourceStatuses(): void {
    const next: Record<string, SourceStatus> = {};
    const sourceIds = new Set(this.config.sources.map((source) => source.id));

    for (const sourceId of Object.keys(this.sourceErrors)) {
      if (!sourceIds.has(sourceId)) {
        delete this.sourceErrors[sourceId];
      }
    }

    for (const source of this.config.sources) {
      const refreshMs = parseRefreshInterval(source.refresh);
      const cacheEntry = this.cache.sources[source.id];

      let cacheStatus: SourceStatus["cacheStatus"] = "missing";
      if (cacheEntry?.last_fetched) {
        cacheStatus = isFresh(cacheEntry.last_fetched, refreshMs) ? "fresh" : "stale";
      }

      const status: SourceStatus = {
        id: source.id,
        type: source.type,
        refresh: toHumanDuration(refreshMs),
        lastFetched: cacheEntry?.last_fetched ?? null,
        cacheStatus,
      };

      const sourceError = this.sourceErrors[source.id];
      if (sourceError) {
        status.error = sourceError;
      }

      next[source.id] = status;
    }

    this.sourceStatuses = next;
  }

  private buildSourceMap(): void {
    this.sourceByWidget = {};
    for (const binding of this.config.widgets) {
      this.sourceByWidget[binding.id] = binding.source;
    }
  }

  private startScheduler(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
    }

    this.schedulerTimer = setInterval(() => {
      this.refresh({ force: false }).catch((error) => {
        const message = errorMessage(error);
        this.notify(`scheduler:error:${message}`);
      });
    }, 60_000);
  }

  private startDashboardWatcher(): void {
    if (this.dashboardWatcher) {
      this.dashboardWatcher.close();
    }

    this.dashboardWatcher = watch(this.paths.dashboardPath, async (eventType) => {
      if (eventType !== "change") {
        return;
      }

      try {
        this.dashboard = await readDashboard(this.paths);
        this.notify("dashboard:file-change");
      } catch {
        // Ignore transient parse errors while file is being written.
      }
    });
  }
}
