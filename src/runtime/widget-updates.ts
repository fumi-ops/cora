import type {
  BarWidget,
  DashboardWidget,
  MetricWidget,
  TableWidget,
  TextWidget,
  TimeseriesWidget,
} from "../types";

function firstScalar(input: unknown): number | string {
  if (typeof input === "number" || typeof input === "string") {
    return input;
  }

  if (Array.isArray(input) && input.length > 0) {
    return firstScalar(input[0]);
  }

  if (typeof input === "object" && input !== null) {
    const values = Object.values(input as Record<string, unknown>);
    if (values.length > 0) {
      return firstScalar(values[0]);
    }
  }

  return 0;
}

function toTimeseriesData(input: unknown): TimeseriesWidget["data"] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const row = item as Record<string, unknown>;
      const date =
        typeof row.date === "string"
          ? row.date
          : typeof row.day === "string"
            ? row.day
            : typeof row.timestamp === "string"
              ? row.timestamp
              : undefined;

      const value =
        typeof row.value === "number"
          ? row.value
          : typeof row.count === "number"
            ? row.count
            : typeof row.total === "number"
              ? row.total
              : undefined;

      if (!date || typeof value !== "number") {
        return null;
      }

      return { date, value };
    })
    .filter((point): point is { date: string; value: number } => Boolean(point));
}

function toBarData(input: unknown): BarWidget["data"] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const row = item as Record<string, unknown>;
      const label =
        typeof row.label === "string"
          ? row.label
          : typeof row.name === "string"
            ? row.name
            : undefined;

      const value =
        typeof row.value === "number"
          ? row.value
          : typeof row.count === "number"
            ? row.count
            : typeof row.total === "number"
              ? row.total
              : undefined;

      if (!label || typeof value !== "number") {
        return null;
      }

      return { label, value };
    })
    .filter((point): point is { label: string; value: number } => Boolean(point));
}

function toTableData(input: unknown): Pick<TableWidget, "columns" | "rows"> {
  if (typeof input === "object" && input !== null && "columns" in input && "rows" in input) {
    const withColumns = input as { columns: string[]; rows: unknown[][] };
    const rows = withColumns.rows.map((row) =>
      row.map((cell) => {
        if (
          typeof cell === "string" ||
          typeof cell === "number" ||
          typeof cell === "boolean" ||
          cell === null
        ) {
          return cell;
        }

        return JSON.stringify(cell);
      }),
    );

    return {
      columns: withColumns.columns,
      rows,
    };
  }

  if (!Array.isArray(input) || input.length === 0) {
    return {
      columns: [],
      rows: [],
    };
  }

  if (Array.isArray(input[0])) {
    const rows = input as Array<Array<string | number | boolean | null>>;
    return {
      columns: rows[0].map((_, idx) => `col_${idx + 1}`),
      rows,
    };
  }

  if (typeof input[0] === "object" && input[0] !== null) {
    const rows = input as Array<Record<string, unknown>>;
    const columns = Object.keys(rows[0]);

    const tableRows = rows.map((row) =>
      columns.map((column) => {
        const value = row[column];
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null
        ) {
          return value;
        }

        return JSON.stringify(value);
      }),
    );

    return {
      columns,
      rows: tableRows,
    };
  }

  return {
    columns: ["value"],
    rows: input.map((item) => [JSON.stringify(item)]),
  };
}

export function applyWidgetResult(widget: DashboardWidget, result: unknown): DashboardWidget {
  switch (widget.type) {
    case "metric": {
      const next = { ...widget } as MetricWidget;

      if (typeof result === "object" && result !== null && "value" in (result as Record<string, unknown>)) {
        const record = result as Record<string, unknown>;
        next.value = firstScalar(record.value);
        if (typeof record.unit === "string") {
          next.unit = record.unit;
        }
        if (typeof record.trend === "string") {
          next.trend = record.trend;
        }
        if (typeof record.trendLabel === "string") {
          next.trendLabel = record.trendLabel;
        }
        if (
          record.status === "good" ||
          record.status === "warning" ||
          record.status === "critical" ||
          record.status === "neutral"
        ) {
          next.status = record.status;
        }
        return next;
      }

      next.value = firstScalar(result);
      return next;
    }

    case "timeseries": {
      const next = { ...widget } as TimeseriesWidget;
      next.data = toTimeseriesData(result);
      return next;
    }

    case "bar": {
      const next = { ...widget } as BarWidget;
      next.data = toBarData(result);
      return next;
    }

    case "table": {
      const next = { ...widget } as TableWidget;
      const table = toTableData(result);
      next.columns = table.columns;
      next.rows = table.rows;
      return next;
    }

    case "text": {
      const next = { ...widget } as TextWidget;
      next.content = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return next;
    }

    default:
      return widget;
  }
}
