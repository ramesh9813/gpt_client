import { useMemo } from "react";
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

export const UsageChart = ({ logs }: Props) => {
  const { chartData, models } = useMemo(() => {
    const groups: Record<number, Record<string, number>> = {};
    const modelSet = new Set<string>();

    // Init hours
    for (let i = 0; i < 24; i++) {
      groups[i] = {};
    }

    logs.forEach((log) => {
      const d = new Date(log.createdAt);
      const hour = d.getHours();
      const model = log.model || "Unknown";
      modelSet.add(model);
      groups[hour][model] = (groups[hour][model] || 0) + (log.tokenCount || 0);
    });

    const data = Object.entries(groups).map(([hour, modelsData]) => ({
      hour: `${hour}:00`,
      ...modelsData,
    }));

    return { chartData: data, models: Array.from(modelSet) };
  }, [logs]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 12, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
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
  );
};
