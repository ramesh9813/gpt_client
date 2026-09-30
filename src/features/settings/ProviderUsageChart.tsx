import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatTokens, getModelColor, type UsageLog } from "./UsageChart";
import "./UsageChart.css";

/** Provider of a usage row: "codecraft:gpt-x" -> "codecraft",
 *  OpenRouter ids ("openai/gpt-4o-mini", "...:free") -> "openrouter". */
export const providerOf = (model: string | null): string => {
  const m = (model || "").trim() || "Unknown";
  const i = m.indexOf(":");
  if (i > 0 && !m.slice(0, i).includes("/")) return m.slice(0, i).toLowerCase();
  if (m === "Unknown") return "unknown";
  return "openrouter";
};

export const providerDisplayName = (provider: string): string =>
  provider === "openrouter" ? "Built-in" : provider;

const pad2 = (value: number) => value.toString().padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// One more card in the Usage tab: per-day tokens per provider, one thick
// stacked bar per day — the tallest color block shows at a glance whose
// models burned the most that day.
export const ProviderUsageChart = ({ logs }: { logs: UsageLog[] }) => {
  const { chartData, providers, providerTotals, grandTotal } = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });

    const buckets: { key: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({ key: toDateKey(d), label: dayFormatter.format(d) });
    }

    const groups: Record<string, Record<string, number>> = {};
    buckets.forEach((b) => {
      groups[b.key] = {};
    });
    const totals = new Map<string, number>();

    logs.forEach((log) => {
      const d = new Date(log.createdAt);
      if (d < start || d > now) return;
      const key = toDateKey(d);
      if (!groups[key]) return;
      const provider = providerOf(log.model);
      const tokens = log.tokenCount || 0;
      groups[key][provider] = (groups[key][provider] || 0) + tokens;
      totals.set(provider, (totals.get(provider) || 0) + tokens);
    });

    const data = buckets.map((b) => ({ label: b.label, ...groups[b.key] }));
    const ranked = Array.from(totals.entries())
      .map(([provider, tokens]) => ({ provider, tokens }))
      .sort((a, b) => b.tokens - a.tokens);
    return {
      chartData: data,
      providers: ranked.map((r) => r.provider),
      providerTotals: ranked,
      grandTotal: ranked.reduce((n, r) => n + r.tokens, 0),
    };
  }, [logs]);

  return (
    <div className="usage-chart">
      <div className="usage-chart-header">
        <div className="usage-chart-title">Token usage by provider • Last 7 days</div>
        <div className="usage-chart-header-right">
          {grandTotal > 0 ? (
            <span
              className="usage-chart-total"
              title={`${grandTotal.toLocaleString()} tokens`}
            >
              {formatTokens(grandTotal)} total
            </span>
          ) : null}
        </div>
      </div>
      <div className="usage-chart-body usage-chart-body--provider">
        {providers.length === 0 ? (
          <div className="usage-chart-empty">No usage in the last 7 days yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="25%" barGap={0}>
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
                  providerDisplayName(String(name)),
                ]}
              />
              {providers.map((provider, index) => (
                <Bar
                  key={provider}
                  dataKey={provider}
                  name={providerDisplayName(provider)}
                  stackId="providerStack"
                  fill={getModelColor(index)}
                  radius={
                    index === providers.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]
                  }
                  maxBarSize={44}
                  barSize={34}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {providerTotals.length > 0 ? (
        <div className="usage-legend">
          <div className="usage-legend-title">Usage by Provider</div>
          <table className="usage-legend-table">
            <thead>
              <tr>
                <th className="usage-legend-th">Provider</th>
                <th className="usage-legend-th-right">Tokens</th>
                <th className="usage-legend-th-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {providerTotals.map((row, index) => {
                const color = getModelColor(index);
                const share = grandTotal > 0 ? (row.tokens / grandTotal) * 100 : 0;
                return (
                  <tr key={row.provider} className="usage-legend-row">
                    <td className="usage-legend-td">
                      <span
                        className="usage-legend-dot"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span title={row.provider} className="usage-legend-name">
                        {providerDisplayName(row.provider)}
                      </span>
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

export default ProviderUsageChart;
