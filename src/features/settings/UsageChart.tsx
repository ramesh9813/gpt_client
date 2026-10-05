import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import "./UsageChart.css";

export type UsageLog = {
  id: string;
  createdAt: string;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  tokenCount: number | null;
};

type Props = {
  logs: UsageLog[];
};

// Distinct per-model palette (12 unique, readable on light + dark themes).
// One color = one model, matched by the "Usage by Model" table below.
const COLORS = [
  "#4E79A7",
  "#F28E2B",
  "#E15759",
  "#76B7B2",
  "#59A14F",
  "#EDC948",
  "#B07AA1",
  "#FF9DA7",
  "#9C755F",
  "#BAB0AC",
  "#00C49F",
  "#0088FE"
];

export const getModelColor = (index: number) => COLORS[index % COLORS.length];

/** Short display name: "provider:model" -> "model", "org/model" -> "model". */
export const shortModelName = (model: string) => {
  const afterColon = model.includes(":") ? model.split(":").pop()! : model;
  return afterColon.includes("/") ? afterColon.split("/").pop()! : afterColon;
};

/** Compact token count: 950 -> "950", 1500 -> "1.5k", 2.3M etc. */
export const formatTokens = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const m = value / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
};

type RangeKey = "day" | "week" | "year";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "year", label: "Last 12 months" },
];

const pad2 = (value: number) => value.toString().padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

type ModelTotal = { model: string; tokens: number };

export const UsageChart = ({ logs }: Props) => {
  const [range, setRange] = useState<RangeKey>("day");

  const { chartData, models, modelTotals, grandTotal, rangeLabel } = useMemo(() => {
    const now = new Date();
    const totals = new Map<string, number>();
    // Short labels only — long date labels overflow the card on narrow
    // screens (weekday for the 7-day view, short month for months).
    const dayFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
    });
    const monthFormatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      year: "numeric",
    });

    const buckets: { key: string; label: string }[] = [];
    let rangeStart = new Date(now);

    if (range === "day") {
      rangeStart.setHours(0, 0, 0, 0);
      // Single stacked bar for today: all models pile into one thick bar
      // so the user can see each model's share at a glance.
      buckets.push({
        key: "today",
        label: "Today",
      });
    } else if (range === "week") {
      rangeStart.setHours(0, 0, 0, 0);
      rangeStart.setDate(rangeStart.getDate() - 6);
      for (let i = 0; i < 7; i++) {
        const d = new Date(rangeStart);
        d.setDate(rangeStart.getDate() + i);
        buckets.push({ key: toDateKey(d), label: dayFormatter.format(d) });
      }
    } else {
      rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      for (let i = 0; i < 12; i++) {
        const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
        buckets.push({ key: toMonthKey(d), label: monthFormatter.format(d) });
      }
    }

    const groups: Record<string, Record<string, number>> = {};
    buckets.forEach((bucket) => {
      groups[bucket.key] = {};
    });

    logs.forEach((log) => {
      const d = new Date(log.createdAt);
      if (range === "day") {
        const start = new Date(rangeStart);
        const end = new Date(rangeStart);
        end.setDate(end.getDate() + 1);
        if (d < start || d >= end) {
          return;
        }
      } else if (d < rangeStart || d > now) {
        return;
      }
      const key =
        range === "day" ? "today" : range === "week" ? toDateKey(d) : toMonthKey(d);
      if (!groups[key]) {
        return;
      }
      const model = log.model || "Unknown";
      const tokens = log.tokenCount || 0;
      groups[key][model] = (groups[key][model] || 0) + tokens;
      totals.set(model, (totals.get(model) || 0) + tokens);
    });

    const data = buckets.map((bucket) => ({
      label: bucket.label,
      ...groups[bucket.key],
    }));

    // Rank models by total tokens so colors are stable and meaningful
    // (top consumer always gets the first palette color).
    const ranked: ModelTotal[] = Array.from(totals.entries())
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
    const grand = ranked.reduce((acc, row) => acc + row.tokens, 0);

    return {
      chartData: data,
      models: ranked.map((row) => row.model),
      modelTotals: ranked,
      grandTotal: grand,
      rangeLabel:
        range === "day"
          ? "Today"
          : range === "week"
          ? "Last 7 days"
          : "Last 12 months",
    };
  }, [logs, range]);

  const isSingleStack = range === "day";
  // Every range stacks: one thick stacked bar per bucket (day / weekday /
  // month) with each model's share piled in — same look as Today.
  const isStacked = true;
  const stackId = range === "day" ? "todayStack" : range === "week" ? "weekStack" : "yearStack";

  return (
    <div className="usage-chart">
      <div className="usage-chart-header">
        <div className="usage-chart-title">
          Token usage • {rangeLabel}
        </div>
        <div className="usage-chart-header-right">
          {grandTotal > 0 ? (
            <span
              className="usage-chart-total"
              title={`${grandTotal.toLocaleString()} tokens`}
            >
              {formatTokens(grandTotal)} total
            </span>
          ) : null}
          <select
            className="usage-chart-select"
            value={range}
            onChange={(event) => setRange(event.target.value as RangeKey)}
            aria-label="Select usage range"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="usage-chart-body">
        {models.length === 0 ? (
          <div className="usage-chart-empty">No usage in this range yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap={isSingleStack ? "30%" : "20%"}
              barGap={0}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => formatTokens(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--panel)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                cursor={{ fill: "var(--muted)", opacity: 0.1 }}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text)" }}
                formatter={(value: any, name: any) => [
                  formatTokens(Number(value) || 0),
                  shortModelName(String(name)),
                ]}
              />
              {models.map((model, index) => (
                <Bar
                  key={model}
                  dataKey={model}
                  name={shortModelName(model)}
                  fill={getModelColor(index)}
                  stackId={stackId}
                  radius={
                    isStacked
                      ? index === models.length - 1
                        ? [8, 8, 0, 0]
                        : [0, 0, 0, 0]
                      : [4, 4, 0, 0]
                  }
                  maxBarSize={isSingleStack ? 72 : 56}
                  barSize={isSingleStack ? 56 : 44}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {modelTotals.length > 0 ? (
        <div className="usage-legend">
          <div className="usage-legend-title">Usage by Model</div>
          <table className="usage-legend-table">
            <thead>
              <tr>
                <th className="usage-legend-th">Model</th>
                <th className="usage-legend-th-right">Tokens</th>
                <th className="usage-legend-th-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {modelTotals.map((row, index) => {
                const color = getModelColor(index);
                const share = grandTotal > 0 ? (row.tokens / grandTotal) * 100 : 0;
                return (
                  <tr key={row.model} className="usage-legend-row">
                    <td className="usage-legend-td">
                      <span
                        className="usage-legend-dot"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span title={row.model} className="usage-legend-name">{shortModelName(row.model)}</span>
                    </td>
                    <td
                      className="usage-legend-td-right"
                      title={`${row.tokens.toLocaleString()} tokens`}
                    >
                      {formatTokens(row.tokens)}
                    </td>
                    <td className="usage-legend-td-right">
                      <span className="usage-share-track" aria-hidden="true">
                        <span
                          className="usage-share-fill"
                          style={{
                            width: `${Math.max(share, 2)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </span>
                      <span className="usage-share-pct">
                        {share < 0.1 && share > 0 ? "<0.1%" : `${share.toFixed(1)}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
