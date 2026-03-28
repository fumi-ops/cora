import { z } from "zod";

const widgetLayoutSchema = z.object({
  col: z.number().int().min(1),
  row: z.number().int().min(1),
  span: z.number().int().min(1).max(12),
});

const metricWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.literal("metric"),
  label: z.string().min(1),
  source: z.string().optional(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  trend: z.string().optional(),
  trendLabel: z.string().optional(),
  status: z.enum(["good", "warning", "critical", "neutral"]).optional(),
  layout: widgetLayoutSchema.optional(),
});

const timeseriesWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.literal("timeseries"),
  label: z.string().min(1),
  source: z.string().optional(),
  chartType: z.enum(["line", "area"]).optional(),
  color: z.string().optional(),
  layout: widgetLayoutSchema.optional(),
  data: z.array(
    z.object({
      date: z.string().min(1),
      value: z.number(),
    }),
  ),
});

const barWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.literal("bar"),
  label: z.string().min(1),
  source: z.string().optional(),
  color: z.string().optional(),
  layout: widgetLayoutSchema.optional(),
  data: z.array(
    z.object({
      label: z.string().min(1),
      value: z.number(),
    }),
  ),
});

const tableWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.literal("table"),
  label: z.string().min(1),
  source: z.string().optional(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  layout: widgetLayoutSchema.optional(),
});

const textWidgetSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text"),
  label: z.string().min(1),
  source: z.string().optional(),
  content: z.string(),
  layout: widgetLayoutSchema.optional(),
});

export const dashboardSchema = z.object({
  title: z.string().min(1),
  updated: z.string().datetime(),
  theme: z.enum(["dark", "light"]).optional(),
  layout: z.enum(["auto", "custom"]).optional(),
  widgets: z.array(
    z.discriminatedUnion("type", [
      metricWidgetSchema,
      timeseriesWidgetSchema,
      barWidgetSchema,
      tableWidgetSchema,
      textWidgetSchema,
    ]),
  ),
});

const sourceTypeSchema = z.string().min(1);

export const sourceSchema = z
  .object({
    id: z.string().min(1),
    type: sourceTypeSchema,
    refresh: z.string().optional(),
  })
  .passthrough();

export const widgetBindingSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  query: z.string().min(1),
  jsonPath: z.string().optional(),
});

export const configSchema = z.object({
  sources: z.array(sourceSchema),
  widgets: z.array(widgetBindingSchema),
});

export type DashboardSchema = z.infer<typeof dashboardSchema>;
export type CoraConfigSchema = z.infer<typeof configSchema>;
