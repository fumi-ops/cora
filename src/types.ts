export type WidgetStatus = "good" | "warning" | "critical" | "neutral";

export type WidgetType = "metric" | "timeseries" | "bar" | "table" | "text";

export interface WidgetLayout {
  col: number;
  row: number;
  span: number;
}

export interface MetricWidget {
  id: string;
  type: "metric";
  label: string;
  source?: string;
  value: number | string;
  unit?: string;
  trend?: string;
  trendLabel?: string;
  status?: WidgetStatus;
  layout?: WidgetLayout;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface TimeseriesWidget {
  id: string;
  type: "timeseries";
  label: string;
  source?: string;
  data: TimeSeriesPoint[];
  chartType?: "line" | "area";
  color?: string;
  layout?: WidgetLayout;
}

export interface BarPoint {
  label: string;
  value: number;
}

export interface BarWidget {
  id: string;
  type: "bar";
  label: string;
  source?: string;
  data: BarPoint[];
  color?: string;
  layout?: WidgetLayout;
}

export interface TableWidget {
  id: string;
  type: "table";
  label: string;
  source?: string;
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
  layout?: WidgetLayout;
}

export interface TextWidget {
  id: string;
  type: "text";
  label: string;
  source?: string;
  content: string;
  layout?: WidgetLayout;
}

export type DashboardWidget =
  | MetricWidget
  | TimeseriesWidget
  | BarWidget
  | TableWidget
  | TextWidget;

export interface DashboardDocument {
  title: string;
  updated: string;
  theme?: "dark" | "light";
  layout?: "auto" | "custom";
  widgets: DashboardWidget[];
}

export type SourceType =
  | "postgres"
  | "mysql"
  | "sqlite"
  | "duckdb"
  | "http"
  | "stripe"
  | "plausible"
  | "github"
  | string;

export interface SourceConfig {
  id: string;
  type: SourceType;
  refresh?: string;
  [key: string]: unknown;
}

export interface WidgetBinding {
  id: string;
  source: string;
  query: string;
  jsonPath?: string;
}

export interface CoraConfig {
  sources: SourceConfig[];
  widgets: WidgetBinding[];
}

export interface CacheEntry {
  last_fetched: string;
}

export interface CacheFile {
  sources: Record<string, CacheEntry>;
}

export interface SourceStatus {
  id: string;
  type: SourceType;
  refresh: string;
  lastFetched: string | null;
  cacheStatus: "fresh" | "stale" | "missing";
  error?: string;
}

export interface RuntimeState {
  dashboard: DashboardDocument;
  widgetErrors: Record<string, string>;
  sourceStatuses: Record<string, SourceStatus>;
  sourceByWidget: Record<string, string>;
  isFetching: boolean;
  version: string;
}

export interface SettingsField {
  sourceId: string;
  key: string;
  exists: boolean;
}

export interface WorkspacePaths {
  rootDir: string;
  dashboardPath: string;
  configPath: string;
  cachePath: string;
  envPath: string;
  agentInstructionsPath: string;
}
