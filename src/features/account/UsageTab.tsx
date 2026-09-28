import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/Button";
import { apiFetch, ApiResponse } from "../../lib/api";
import { UsageChart, UsageLog } from "../settings/UsageChart";

export const UsageTab = () => {
  const { data: usageData } = useQuery({
    queryKey: ["usage", "year"],
    queryFn: () =>
      apiFetch<ApiResponse<{ items: UsageLog[] }>>("/api/me/usage?range=year"),
  });

  const logs = usageData?.data?.items || [];

  type TokenRange = "today" | "week" | "month" | "year" | "all";
  const TOKEN_RANGE_OPTIONS: { value: TokenRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "Weekly" },
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly" },
    { value: "all", label: "All time" },
  ];
  const [tokenRange, setTokenRange] = useState<TokenRange>("today");
  const tokenRangeLabel =
    TOKEN_RANGE_OPTIONS.find((o) => o.value === tokenRange)?.label || "Today";

  const rangeStats = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    if (tokenRange === "today") {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (tokenRange === "week") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (tokenRange === "month") {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (tokenRange === "year") {
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
    let tokens = 0;
    let requests = 0;
    const models = new Set<string>();
    logs.forEach((log) => {
      if (start && new Date(log.createdAt) < start) return;
      requests += 1;
      tokens += log.tokenCount || 0;
      models.add(log.model || "Unknown");
    });
    return { tokens, requests, modelsUsed: models.size };
  }, [logs, tokenRange]);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const sortedLogs = useMemo(
    () =>
      [...logs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [logs]
  );
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedLogs = sortedLogs.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const startIndex = sortedLogs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, sortedLogs.length);

  return (
    <div className="account-wide">
      <div>
        <div className="account-usage-head">
          <h2 className="account-usage-title">Usage Statistics ({tokenRangeLabel})</h2>
          <select
            className="account-range-select"
            value={tokenRange}
            onChange={(event) => setTokenRange(event.target.value as TokenRange)}
            aria-label="Select usage stats range"
          >
            {TOKEN_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="account-stat-grid">
          <div className="account-stat-card">
            <div className="account-stat-label">Tokens Used ({tokenRangeLabel})</div>
            <div className="account-stat-value">
              {rangeStats.tokens.toLocaleString()}
            </div>
          </div>
          <div className="account-stat-card">
            <div className="account-stat-label">Requests ({tokenRangeLabel})</div>
            <div className="account-stat-value">
              {rangeStats.requests.toLocaleString()}
            </div>
          </div>
          <div className="account-stat-card">
            <div className="account-stat-label">Models Used ({tokenRangeLabel})</div>
            <div className="account-stat-value">{rangeStats.modelsUsed}</div>
          </div>
          <div className="account-stat-card">
             <div className="account-stat-label">Current Plan</div>
             <div className="account-stat-value">Free</div>
          </div>
        </div>
      </div>

      <div className="account-chart-card">
        <UsageChart logs={logs} />
      </div>

      <div>
        <h3 className="account-log-title">Detailed Logs</h3>
        <div className="account-table-wrap">
          <table className="account-table">
            <thead className="account-table-head">
              <tr>
                <th className="account-table-th">Date & Time</th>
                <th className="account-table-th">Model</th>
                <th className="account-table-th-right">Input</th>
                <th className="account-table-th-right">Output</th>
                <th className="account-table-th-right">Total</th>
              </tr>
            </thead>
            <tbody className="account-table-body">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="account-table-empty">
                    No usage recorded yet.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => (
                  <tr key={log.id} className="account-table-row">
                    <td className="account-table-td-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                      <span className="account-table-date-sub">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="account-table-td">{log.model || "-"}</td>
                    <td className="account-table-td-right">{log.promptTokens ?? "-"}</td>
                    <td className="account-table-td-right">{log.completionTokens ?? "-"}</td>
                    <td className="account-table-td-right-bold">{log.tokenCount ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedLogs.length > 0 ? (
          <div className="account-pagination">
            <span>
              Showing {startIndex}-{endIndex} of {sortedLogs.length}
            </span>
            <div className="account-pagination-controls">
              <Button
                variant="outline"
                className="account-pagination-btn"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <span className="account-pagination-label">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                className="account-pagination-btn"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default UsageTab;
