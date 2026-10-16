import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiResponse, getApiBase } from "../../lib/api";
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

// Google Drive mark: gradient rounded square + white triangle-ish "D".
// Same inline-SVG approach as Canva (no brand font needed).
export const DriveIcon = ({ size = 28 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    role="img"
    aria-label="Google Drive"
  >
    <defs>
      <linearGradient id="drive-connector-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#34A853" />
        <stop offset="0.55" stopColor="#FBBC05" />
        <stop offset="1" stopColor="#4285F4" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="10" fill="url(#drive-connector-g)" />
    <text
      x="24"
      y="33"
      textAnchor="middle"
      fontSize="26"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
      fill="#ffffff"
    >
      D
    </text>
  </svg>
);

type ConnectorDef = {
  provider: string;
  name: string;
  blurb: string;
  Icon: ({ size }: { size?: number }) => JSX.Element;
};

const CONNECTORS: ConnectorDef[] = [
  {
    provider: "canva",
    name: "Canva",
    blurb:
      "Let the assistant search your designs, assets and brand templates, and create new designs — right from chat.",
    Icon: CanvaIcon,
  },
  {
    provider: "google",
    name: "Google Drive",
    blurb:
      "Let the assistant list, search and read your Drive documents, spreadsheets and presentations — right from chat.",
    Icon: DriveIcon,
  },
];

export const ConnectedAppsTab = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["connectors-status"],
    queryFn: () => apiFetch<ApiResponse<StatusResponse>>("/api/connectors/status"),
    retry: false,
    staleTime: 1000 * 60,
  });

  // OAuth landing: /account?connector=<provider>&connected=1 — refresh status
  // once, then drop the query string so reloads stay clean.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("connector")) {
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

  const byProvider = (provider: string) =>
    data?.data?.providers?.find((p) => p.provider === provider);

  const connect = (provider: string) => {
    // OAuth authorize relies on httpOnly cookies; no token in query string.
    window.location.href = `${getApiBase()}/api/connectors/${provider}/authorize`;
  };

  const disconnect = async (provider: string) => {
    await apiFetch(`/api/connectors/${provider}/disconnect`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["connectors-status"] });
  };

  return (
    <div className="account-narrow">
      <h2 className="account-section-title">Connected Apps</h2>
      <div className="account-stack-lg">
        {CONNECTORS.map(({ provider, name, blurb, Icon }) => {
          const entry = byProvider(provider);
          return (
            <div className="account-card" key={provider}>
              <div className="account-profile-header">
                <Icon />
                <div>
                  <h3 className="account-profile-name">{name}</h3>
                  <p className="account-card-desc">{blurb}</p>
                </div>
              </div>
              <div className="account-btn-row">
                {isLoading || isFetching ? (
                  <span className="account-status">Checking…</span>
                ) : isError || !entry?.connected ? (
                  <Button onClick={() => connect(provider)} variant="outline">
                    Connect {name}
                  </Button>
                ) : (
                  <>
                    <span className="account-status" role="status">
                      Connected{entry.tools.length > 0 ? ` · ${entry.tools.length} tools` : ""}
                    </span>
                    <DisconnectButton onDisconnect={() => disconnect(provider)} />
                  </>
                )}
              </div>
              {entry?.connected && entry.tools.length > 0 ? (
                <p className="account-check-hint" title={entry.tools.join(", ")}>
                  Available: {entry.tools.slice(0, 6).join(", ")}
                  {entry.tools.length > 6 ? ` +${entry.tools.length - 6} more` : ""}
                </p>
              ) : null}
            </div>
          );
        })}
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
