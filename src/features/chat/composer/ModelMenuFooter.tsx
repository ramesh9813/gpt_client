
export interface ModelMenuFooterProps {
  total: number;
  updatedAgo: string;
  offline: boolean;
  modelResetNotice?: string | null;
  onRefreshModels?: () => void;
  modelsRefreshing?: boolean;
}

export const ModelMenuFooter = ({
  total,
  updatedAgo,
  offline,
  modelResetNotice,
  onRefreshModels,
  modelsRefreshing = false,
}: ModelMenuFooterProps) => {
  return (
    <div className="composer-model-footer">
      <span className="composer-model-footer-text">
        {total} models · updated {updatedAgo}
      </span>
      {onRefreshModels && (
        <button
          type="button"
          className="composer-model-refresh"
          onClick={onRefreshModels}
          disabled={modelsRefreshing}
          aria-label="Refresh model list"
          title="Refresh model list"
        >
          <i
            className={`bi bi-arrow-clockwise composer-model-refresh-icon${
              modelsRefreshing ? " is-spinning" : ""
            }`}
            aria-hidden="true"
          ></i>
        </button>
      )}
      {offline && (
        <span className="composer-model-offline">
          Offline — showing cached list
        </span>
      )}
      {modelResetNotice && (
        <div className="composer-model-reset-notice" role="status">
          {modelResetNotice}
        </div>
      )}
    </div>
  );
};
