import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

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

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#0088fe",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#a4de6c",
  "#d0ed57",
  "#83a6ed",
  "#8dd1e1",
  "#82ca9d",
  "#a4de6c",
  "#d0ed57"
];

const getModelColor = (index: number) => COLORS[index % COLORS.length];

type RangeKey = "day" | "week" | "year";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "day", label: "Today (hourly)" },
  { value: "week", label: "Last 7 days" },
  { value: "year", label: "Last 12 months" },
];

const pad2 = (value: number) => value.toString().padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

export const UsageChart = ({ logs }: Props) => {
  const [range, setRange] = useState<RangeKey>("day");

  const { chartData, models, rangeLabel } = useMemo(() => {
    const now = new Date();
    const modelSet = new Set<string>();
    const dayFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const monthFormatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      year: "numeric",
    });

    const buckets: { key: string; label: string }[] = [];
    let rangeStart = new Date(now);

    if (range === "day") {
      rangeStart.setHours(0, 0, 0, 0);
      for (let i = 0; i < 24; i++) {
        buckets.push({
          key: pad2(i),
          label: String(i),
        });
      }
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
        range === "day" ? pad2(d.getHours()) : range === "week" ? toDateKey(d) : toMonthKey(d);
      if (!groups[key]) {
        return;
      }
      const model = log.model || "Unknown";
      modelSet.add(model);
      groups[key][model] = (groups[key][model] || 0) + (log.tokenCount || 0);
    });

    const data = buckets.map((bucket) => ({
      label: bucket.label,
      ...groups[bucket.key],
    }));

    return {
      chartData: data,
      models: Array.from(modelSet),
      rangeLabel:
        range === "day"
          ? "Today (hourly)"
          : range === "week"
          ? "Last 7 days"
          : "Last 12 months",
    };
  }, [logs, range]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-[var(--muted)]">
          Usage by Model • {rangeLabel}
        </div>
        <select
          className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
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
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--panel)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              cursor={{ fill: "var(--muted)", opacity: 0.1 }}
              itemStyle={{ color: "var(--text)" }}
              formatter={(value: number, name: string) => [value, name]}
            />
            <Legend />
            {models.map((model, index) => (
              <Bar
                key={model}
                dataKey={model}
                stackId="a"
                fill={getModelColor(index)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
