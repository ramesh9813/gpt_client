import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse, getApiBase, getStoredAccessToken } from "../../lib/api";
import { Button } from "../../components/Button";

type ConnectorStatus = {
  provider: string;
  connected: boolean;
  tools: string[];
};

type StatusResponse = {
  providers: ConnectorStatus[];
};

// Canva "C" mark: gradient rounded square + white C. bootstrap-icons has no
// brand glyph for Canva, so the mark ships as inline SVG (no new deps).
export const CanvaIcon = ({ size = 28 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    role="img"
    aria-label="Canva"
  >
    <defs>
      <linearGradient id="canva-connector-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#00C4CC" />
        <stop offset="1" stopColor="#7D2AE8" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="10" fill="url(#canva-connector-g)" />
    <text
      x="24"
      y="33"
      textAnchor="middle"
      fontSize="26"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
      fill="#ffffff"
    >
      C
    </text>
  </svg>
);

export const ConnectedAppsTab = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["connectors-status"],
    queryFn: () => apiFetch<ApiResponse<StatusResponse>>("/api/connectors/status"),
    retry: false,
    staleTime: 1000 * 60,
  });

  // OAuth landing: /account?connector=canva&connected=1 — refresh status
  // once, then drop the query string so reloads stay clean.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connector") === "canva") {
        void refetch();
        params.delete("connector");
        params.delete("connected");
        params.delete("error");
        const rest = params.toString();
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${rest ? `?${rest}` : ""}`
        );
      }
    } catch {
      // non-browser / ignore
    }
  }, [refetch]);

  const canva = data?.data?.providers?.find((p) => p.provider === "canva");

  const connect = () => {
    // Full navigation (not fetch): OAuth needs a real top-level redirect.
    // Top-level navigation cannot send the Authorization header and cookies
    // are often missing cross-origin, so pass the stored access token as
    // ?token=. Server verifies it, else redirects to /login.
    const token = getStoredAccessToken();
    const target = token
      ? `${getApiBase()}/api/connectors/canva/authorize?token=${encodeURIComponent(token)}`
      : `${getApiBase()}/api/connectors/canva/authorize`;
    window.location.href = target;
  };

  const disconnect = async () => {
    await apiFetch("/api/connectors/canva/disconnect", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["connectors-status"] });
  };

  return (
    <div className="account-narrow">
      <h2 className="account-section-title">Connected Apps</h2>
      <div className="account-stack-lg">
        <div className="account-card">
          <div className="account-profile-header">
            <CanvaIcon />
            <div>
              <h3 className="account-profile-name">Canva</h3>
              <p className="account-card-desc">
                Let the assistant search your designs, assets and brand
                templates, and create new designs — right from chat.
              </p>
            </div>
          </div>
          <div className="account-btn-row">
            {isLoading || isFetching ? (
              <span className="account-status">Checking…</span>
            ) : isError || !canva?.connected ? (
              <Button onClick={connect} variant="outline">
                Connect Canva
              </Button>
            ) : (
              <>
                <span className="account-status" role="status">
                  Connected{canva.tools.length > 0 ? ` · ${canva.tools.length} tools` : ""}
                </span>
                <DisconnectButton onDisconnect={disconnect} />
              </>
            )}
          </div>
          {canva?.connected && canva.tools.length > 0 ? (
            <p className="account-check-hint" title={canva.tools.join(", ")}>
              Available: {canva.tools.slice(0, 6).join(", ")}
              {canva.tools.length > 6 ? ` +${canva.tools.length - 6} more` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const DisconnectButton = ({ onDisconnect }: { onDisconnect: () => Promise<void> }) => {
  return (
    <Button
      variant="outline"
      onClick={() => {
        void onDisconnect().catch(() => {
          // status query surfaces the truth on next load
        });
      }}
    >
      Disconnect
    </Button>
  );
};

export default ConnectedAppsTab;
