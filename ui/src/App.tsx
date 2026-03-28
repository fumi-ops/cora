import { useEffect, useMemo, useState } from "react";

import { SettingsPanel } from "./components/SettingsPanel";
import { TopBar } from "./components/TopBar";
import { WidgetRenderer, WidgetSkeleton } from "./components/WidgetRenderer";
import { getSettings, getState, refreshDashboard, setCredential, subscribeState } from "./lib/api";
import type { DashboardWidget, RuntimeState, SettingsField } from "./types";

const AUTO_SPAN_BY_WIDGET: Record<DashboardWidget["type"], number> = {
  metric: 4,
  timeseries: 8,
  bar: 6,
  table: 12,
  text: 4,
};

const EMPTY_STATE: RuntimeState = {
  dashboard: {
    title: "Cora",
    updated: new Date().toISOString(),
    layout: "auto",
    theme: "dark",
    widgets: [],
  },
  widgetErrors: {},
  sourceStatuses: {},
  sourceByWidget: {},
  isFetching: false,
  version: "",
};

export default function App() {
  const [state, setState] = useState<RuntimeState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsFields, setSettingsFields] = useState<SettingsField[]>([]);

  const [hasStoredTheme, setHasStoredTheme] = useState<boolean>(() => {
    const stored = localStorage.getItem("cora_theme");
    return stored === "light" || stored === "dark";
  });

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem("cora_theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }

    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (hasStoredTheme) {
      localStorage.setItem("cora_theme", theme);
    }
  }, [theme, hasStoredTheme]);

  useEffect(() => {
    if (hasStoredTheme) {
      return;
    }

    if (state.dashboard.theme === "light" || state.dashboard.theme === "dark") {
      setTheme(state.dashboard.theme);
    }
  }, [hasStoredTheme, state.dashboard.theme]);

  useEffect(() => {
    getState()
      .then((nextState) => {
        setState(nextState);
      })
      .finally(() => {
        setLoading(false);
      });

    getSettings().then((settings) => {
      setSettingsFields(settings.fields);
    });

    const unsubscribe = subscribeState(
      (nextState) => {
        setState(nextState);
      },
      () => {
        // EventSource handles reconnection behavior.
      },
    );

    return unsubscribe;
  }, []);

  const gridStyle = useMemo(() => ({
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
  }), []);

  const handleRefresh = async () => {
    await refreshDashboard();
  };

  const saveCredential = async (key: string, value: string) => {
    await setCredential(key, value);
    setSettingsFields((prev) =>
      prev.map((field) => (field.key === key ? { ...field, exists: true } : field)),
    );
  };

  const metricWidgets = state.dashboard.widgets.filter((widget) => widget.type === "metric");
  const chartWidgets = state.dashboard.widgets.filter(
    (widget) => widget.type === "timeseries" || widget.type === "bar",
  );
  const tableWidgets = state.dashboard.widgets.filter((widget) => widget.type === "table");
  const textWidgets = state.dashboard.widgets.filter((widget) => widget.type === "text");

  const renderWidget = (widget: DashboardWidget) => {
    const sourceId = state.sourceByWidget[widget.id] ?? widget.source;
    const source = sourceId ? state.sourceStatuses[sourceId] : undefined;

    return (
      <WidgetRenderer
        key={widget.id}
        widget={widget}
        sourceLabel={sourceId}
        lastFetched={source?.lastFetched}
        error={state.widgetErrors[widget.id]}
        theme={theme}
        onRetry={
          sourceId
            ? () => {
                void refreshDashboard({ sourceId, widgetId: widget.id });
              }
            : undefined
        }
      />
    );
  };

  const autoLayout = (
    <div className="space-y-6">
      {metricWidgets.length ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricWidgets.map(renderWidget)}
        </section>
      ) : null}

      {chartWidgets.length ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {chartWidgets.map(renderWidget)}
        </section>
      ) : null}

      {tableWidgets.length ? <section className="grid grid-cols-1 gap-4">{tableWidgets.map(renderWidget)}</section> : null}

      {textWidgets.length ? <section className="grid grid-cols-1 gap-4">{textWidgets.map(renderWidget)}</section> : null}
    </div>
  );

  const customLayout = (
    <section className="grid gap-4" style={gridStyle}>
      {state.dashboard.widgets.map((widget) => {
        const sourceId = state.sourceByWidget[widget.id] ?? widget.source;
        const source = sourceId ? state.sourceStatuses[sourceId] : undefined;
        const layout = widget.layout ?? { col: 1, row: 1, span: AUTO_SPAN_BY_WIDGET[widget.type] };

        return (
          <div
            key={widget.id}
            style={{
              gridColumn: `${layout.col} / span ${layout.span}`,
              gridRow: `${layout.row}`,
            }}
          >
            <WidgetRenderer
              widget={widget}
              sourceLabel={sourceId}
              lastFetched={source?.lastFetched}
              error={state.widgetErrors[widget.id]}
              theme={theme}
              onRetry={
                sourceId
                  ? () => {
                      void refreshDashboard({ sourceId, widgetId: widget.id });
                    }
                  : undefined
              }
            />
          </div>
        );
      })}
    </section>
  );

  return (
    <div className="relative min-h-screen">
      <main className="mx-auto w-full max-w-370 p-4 sm:p-6 lg:p-8">
        <div className="border border-(--cora-border) bg-(--cora-panel) shadow-2xl shadow-black/5 backdrop-blur-xl">
          <div className="space-y-12 p-6 sm:p-8 lg:p-12">
            <TopBar
              title={state.dashboard.title}
              updated={state.dashboard.updated}
              isFetching={state.isFetching}
              onRefresh={handleRefresh}
              onOpenSettings={() => setSettingsOpen(true)}
            />

            {loading ? (
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <WidgetSkeleton key={index} />
                ))}
              </section>
            ) : state.dashboard.layout === "custom" ? (
              customLayout
            ) : (
              autoLayout
            )}
          </div>
        </div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        fields={settingsFields}
        version={state.version}
        theme={theme}
        onThemeChange={(nextTheme) => {
          setTheme(nextTheme);
          setHasStoredTheme(true);
          localStorage.setItem("cora_theme", nextTheme);
        }}
        onClose={() => setSettingsOpen(false)}
        onSaveCredential={saveCredential}
      />
    </div>
  );
}
