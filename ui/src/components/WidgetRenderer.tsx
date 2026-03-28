import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDownIcon, SortingDownIcon, SortingUpIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { marked } from "marked";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from "chart.js";

import type {
  BarWidget,
  DashboardWidget,
  MetricWidget,
  TableWidget,
  TextWidget,
  TimeseriesWidget,
} from "../types";
import { cx } from "../lib/utils";
import { formatTagLabel } from "../lib/utils";
import { sanitizeHtml } from "../lib/sanitize-html";
import {
  Badge,
  Button,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "./basecoat";

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  LineController,
  Filler,
  Tooltip,
  Legend,
);

interface WidgetRendererProps {
  widget: DashboardWidget;
  sourceLabel?: string;
  lastFetched?: string | null;
  error?: string;
  onRetry?: () => void;
  theme: "dark" | "light";
}

function formatNumericValue(value: number): string {
  return Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function statusVariant(status: MetricWidget["status"]): "success" | "warning" | "error" | "neutral" {
  if (status === "good") return "success";
  if (status === "warning") return "warning";
  if (status === "critical") return "error";
  return "neutral";
}

function trendVariant(trend?: string): "success" | "error" | "neutral" {
  if (!trend) {
    return "neutral";
  }

  const normalized = trend.trim().toLowerCase();
  if (normalized.startsWith("+")) {
    return "success";
  }

  if (normalized.startsWith("-")) {
    return "error";
  }

  return "neutral";
}

function getSourceColor(sourceId?: string): string {
  if (!sourceId) return "blue";
  const lower = sourceId.toLowerCase();
  if (lower.includes("stripe")) return "emerald";
  if (lower.includes("plausible")) return "cyan";
  if (lower.includes("github")) return "violet";
  if (lower.includes("post")) return "amber";
  return "blue";
}

function metricAccentClass(status: MetricWidget["status"], sourceId?: string): string {
  const sourceColor = getSourceColor(sourceId);
  if (status === "good") return `border-t-2 border-t-emerald-500/50`;
  if (status === "warning") return `border-t-2 border-t-amber-500/50`;
  if (status === "critical") return `border-t-2 border-t-rose-500/50`;
  
  // Use source-based color for neutral but active widgets
  const colors: Record<string, string> = {
    emerald: "border-t-2 border-t-emerald-500/30",
    cyan: "border-t-2 border-t-cyan-500/30",
    violet: "border-t-2 border-t-violet-500/30",
    amber: "border-t-2 border-t-amber-500/30",
    blue: "border-t-2 border-t-blue-500/30",
  };
  return colors[sourceColor] || "border-t-2 border-t-(--cora-border)";
}

function MetricBody({ widget }: { widget: MetricWidget }) {
  const deltaLabel = widget.trend ?? widget.status ?? "neutral";
  const deltaVariant = widget.trend ? trendVariant(widget.trend) : statusVariant(widget.status);

  return (
    <div className="mt-7 space-y-4">
      <p className="font-display text-4xl font-semibold tracking-[-0.05em] text-(--cora-text) sm:text-5xl">
        {widget.unit ?? ""}
        {widget.value}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-(--cora-text-muted)">{widget.trendLabel ?? "No trend"}</p>
        <Badge variant={deltaVariant}>
          {deltaLabel}
        </Badge>
      </div>
    </div>
  );
}

const CHART_THEME = {
  light: {
    grid: "rgba(148, 163, 184, 0.22)",
    tick: "#475569",
    tooltipBg: "#ffffff",
    tooltipBorder: "rgba(148, 163, 184, 0.35)",
    tooltipText: "#0f172a",
  },
  dark: {
    grid: "rgba(148, 163, 184, 0.18)",
    tick: "#cbd5e1",
    tooltipBg: "#0f172a",
    tooltipBorder: "rgba(51, 65, 85, 0.9)",
    tooltipText: "#f8fafc",
  },
} as const;

type SeriesColor = {
  hex: string;
  rgba: string;
};

const SERIES_COLORS: Record<string, SeriesColor> = {
  blue: { hex: "#3b82f6", rgba: "rgba(59, 130, 246, 0.2)" },
  emerald: { hex: "#10b981", rgba: "rgba(16, 185, 129, 0.2)" },
  violet: { hex: "#8b5cf6", rgba: "rgba(139, 92, 246, 0.2)" },
  amber: { hex: "#f59e0b", rgba: "rgba(245, 158, 11, 0.22)" },
  cyan: { hex: "#06b6d4", rgba: "rgba(6, 182, 212, 0.2)" },
  indigo: { hex: "#6366f1", rgba: "rgba(99, 102, 241, 0.2)" },
  rose: { hex: "#f43f5e", rgba: "rgba(244, 63, 94, 0.2)" },
  orange: { hex: "#f97316", rgba: "rgba(249, 115, 22, 0.2)" },
  slate: { hex: "#64748b", rgba: "rgba(100, 116, 139, 0.2)" },
  gray: { hex: "#6b7280", rgba: "rgba(107, 114, 128, 0.2)" },
  green: { hex: "#22c55e", rgba: "rgba(34, 197, 94, 0.2)" },
  teal: { hex: "#14b8a6", rgba: "rgba(20, 184, 166, 0.2)" },
  sky: { hex: "#0ea5e9", rgba: "rgba(14, 165, 233, 0.2)" },
  pink: { hex: "#ec4899", rgba: "rgba(236, 72, 153, 0.2)" },
  red: { hex: "#ef4444", rgba: "rgba(239, 68, 68, 0.2)" },
  yellow: { hex: "#eab308", rgba: "rgba(234, 179, 8, 0.2)" },
  lime: { hex: "#84cc16", rgba: "rgba(132, 204, 22, 0.2)" },
  fuchsia: { hex: "#d946ef", rgba: "rgba(217, 70, 239, 0.2)" },
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (expanded.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return hex;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function resolveSeriesColor(color?: string): SeriesColor {
  if (!color) {
    return SERIES_COLORS.blue;
  }

  const normalized = color.trim().toLowerCase();
  if (normalized in SERIES_COLORS) {
    return SERIES_COLORS[normalized];
  }

  if (normalized.startsWith("#")) {
    return {
      hex: normalized,
      rgba: hexToRgba(normalized, 0.2),
    };
  }

  return SERIES_COLORS.blue;
}

function buildLineChartConfig({
  labels,
  values,
  color,
  theme,
  area,
  title,
}: {
  labels: string[];
  values: number[];
  color?: string;
  theme: "dark" | "light";
  area: boolean;
  title: string;
}): ChartConfiguration<"line"> {
  const palette = resolveSeriesColor(color);
  const themeColors = CHART_THEME[theme];

  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          borderColor: palette.hex,
          backgroundColor: area ? palette.rgba : palette.hex,
          fill: area,
          tension: 0.35,
          pointRadius: area ? 0 : 2,
          pointHoverRadius: 4,
          pointBackgroundColor: palette.hex,
          pointBorderColor: palette.hex,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 240 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.tooltipBorder,
          borderWidth: 1,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          padding: 12,
          callbacks: {
            title: (items) => items[0]?.label ?? "",
            label: (context) => `Value: ${formatNumericValue(Number(context.parsed.y))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: themeColors.tick,
            maxRotation: 0,
            autoSkip: true,
          },
          border: { color: themeColors.grid },
        },
        y: {
          beginAtZero: true,
          grid: { color: themeColors.grid },
          ticks: {
            color: themeColors.tick,
            callback: (value) => formatNumericValue(Number(value)),
          },
          border: { color: themeColors.grid },
        },
      },
    },
  };
}

function buildBarChartConfig({
  labels,
  values,
  color,
  theme,
  title,
}: {
  labels: string[];
  values: number[];
  color?: string;
  theme: "dark" | "light";
  title: string;
}): ChartConfiguration<"bar"> {
  const palette = resolveSeriesColor(color);
  const themeColors = CHART_THEME[theme];

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          backgroundColor: palette.rgba,
          borderColor: palette.hex,
          borderWidth: 1,
          borderRadius: 8,
          hoverBackgroundColor: hexToRgba(palette.hex, 0.32),
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 240 },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.tooltipBorder,
          borderWidth: 1,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          padding: 12,
          callbacks: {
            title: (items) => items[0]?.label ?? "",
            label: (context) => `Value: ${formatNumericValue(Number(context.parsed.y))}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: themeColors.tick },
          border: { color: themeColors.grid },
        },
        y: {
          beginAtZero: true,
          grid: { color: themeColors.grid },
          ticks: {
            color: themeColors.tick,
            callback: (value) => formatNumericValue(Number(value)),
          },
          border: { color: themeColors.grid },
        },
      },
    },
  };
}

function ChartCanvas({ config }: { config: ChartConfiguration<"line"> | ChartConfiguration<"bar"> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const chart = new Chart(canvas, config as any);
    return () => {
      chart.destroy();
    };
  }, [config]);

  return <canvas ref={canvasRef} />;
}

function TimeseriesBody({ widget, theme }: { widget: TimeseriesWidget; theme: "dark" | "light" }) {
  const chartConfig = useMemo(
    () =>
      buildLineChartConfig({
        labels: widget.data.map((point) => point.date),
        values: widget.data.map((point) => point.value),
        color: widget.color,
        theme,
        area: widget.chartType === "area",
        title: widget.label,
      }),
    [theme, widget.chartType, widget.color, widget.data, widget.label],
  );

  return (
    <div className="mt-6 h-48 rounded-none border border-(--cora-border) bg-(--cora-bg) p-2">
      <ChartCanvas config={chartConfig} />
    </div>
  );
}

function BarBody({ widget, theme }: { widget: BarWidget; theme: "dark" | "light" }) {
  const chartConfig = useMemo(
    () =>
      buildBarChartConfig({
        labels: widget.data.map((point) => point.label),
        values: widget.data.map((point) => point.value),
        color: widget.color,
        theme,
        title: widget.label,
      }),
    [theme, widget.color, widget.data, widget.label],
  );

  return (
    <div className="mt-6 h-48 rounded-none border border-(--cora-border) bg-(--cora-bg) p-2">
      <ChartCanvas config={chartConfig} />
    </div>
  );
}

function compareRows(a: unknown, b: unknown, asc: boolean): number {
  if (typeof a === "number" && typeof b === "number") {
    return asc ? a - b : b - a;
  }

  const aString = String(a ?? "");
  const bString = String(b ?? "");
  return asc ? aString.localeCompare(bString) : bString.localeCompare(aString);
}

function TableBodyWidget({ widget }: { widget: TableWidget }) {
  const [sortState, setSortState] = useState<{ index: number; asc: boolean } | null>(null);

  const rows = useMemo(() => {
    if (!sortState) {
      return widget.rows;
    }

    const next = [...widget.rows];
    next.sort((a, b) => compareRows(a[sortState.index], b[sortState.index], sortState.asc));
    return next;
  }, [widget.rows, sortState]);

  return (
    <TableRoot className="mt-6 rounded-none border border-(--cora-border) bg-(--cora-panel)/50">
      <Table className="text-left">
        <TableHead className="bg-(--cora-panel-muted)/50">
          <TableRow>
            {widget.columns.map((column, index) => (
              <TableHeaderCell
                key={column}
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-(--cora-text-muted)"
                aria-sort={
                  sortState?.index === index ? (sortState.asc ? "ascending" : "descending") : "none"
                }
              >
                <button
                  type="button"
                  className="btn-ghost h-8 px-2 text-left text-inherit"
                  onClick={() =>
                    setSortState((prev) => {
                      if (!prev || prev.index !== index) {
                        return { index, asc: true };
                      }

                      return { index, asc: !prev.asc };
                    })
                  }
                >
                  <span>{column}</span>
                  <span aria-hidden="true">
                    {sortState?.index === index ? (
                      sortState.asc ? (
                        <HugeiconsIcon
                          icon={SortingUpIcon}
                          size={14}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="text-gray-500 dark:text-gray-400"
                        />
                      ) : (
                        <HugeiconsIcon
                          icon={SortingDownIcon}
                          size={14}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="text-gray-500 dark:text-gray-400"
                        />
                      )
                    ) : (
                      <HugeiconsIcon
                        icon={ArrowUpDownIcon}
                        size={14}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="text-gray-400 dark:text-gray-500"
                      />
                    )}
                  </span>
                </button>
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              className="hover:bg-(--cora-border)/10 transition-colors"
            >
              {row.map((cell, cellIndex) => (
                <TableCell key={`${rowIndex}-${cellIndex}`}>
                  <span className="text-(--cora-text)">{String(cell ?? "")}</span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableRoot>
  );
}

function TextBody({ widget }: { widget: TextWidget }) {
  const html = useMemo(
    () => sanitizeHtml(marked.parse(widget.content, { async: false }) as string),
    [widget.content],
  );

  return (
    <article
      className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-300"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ErrorBody({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
        <p className="font-semibold">Widget failed</p>
        <p className="mt-1 whitespace-pre-wrap">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function WidgetRenderer({
  widget,
  sourceLabel,
  lastFetched,
  error,
  onRetry,
  theme,
}: WidgetRendererProps) {
  const headerMeta = [
    sourceLabel ? `Source: ${formatTagLabel(sourceLabel)}` : null,
    lastFetched ? `Fetched: ${new Date(lastFetched).toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Card
      className={cx(
        "group transition duration-300 hover:shadow-2xl hover:shadow-black/5 hover:border-(--cora-accent)/30",
        widget.type === "metric" ? metricAccentClass(widget.status, sourceLabel) : undefined,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-(--cora-text)">{widget.label}</h2>
          {headerMeta ? <p className="text-xs text-(--cora-text-muted)">{headerMeta}</p> : null}
        </div>
        {sourceLabel ? (
          <Badge variant="neutral">
            {formatTagLabel(sourceLabel)}
          </Badge>
        ) : null}
      </div>

      {error ? <ErrorBody message={error} onRetry={onRetry} /> : null}
      {!error && widget.type === "metric" ? <MetricBody widget={widget} /> : null}
      {!error && widget.type === "timeseries" ? <TimeseriesBody widget={widget} theme={theme} /> : null}
      {!error && widget.type === "bar" ? <BarBody widget={widget} theme={theme} /> : null}
      {!error && widget.type === "table" ? <TableBodyWidget widget={widget} /> : null}
      {!error && widget.type === "text" ? <TextBody widget={widget} /> : null}
    </Card>
  );
}

export function WidgetSkeleton() {
  return (
    <Card className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-36 w-full" />
    </Card>
  );
}
