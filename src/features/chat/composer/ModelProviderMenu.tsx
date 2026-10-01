export interface ProviderChoice {
  id: string;
  name: string;
}

export interface ModelProviderMenuProps {
  providers: ProviderChoice[];
  value: string;
  allLabel: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Provider dropdown for the hierarchical model picker. Mirrors ModelSortMenu
 * structure and the composer-* design tokens (button, menu, option, active
 * states) so it integrates seamlessly between Back and the sort dropdown.
 * The caller supplies only keyed providers — unkeyed ones never appear here.
 */
export const ModelProviderMenu = ({
  providers,
  value,
  allLabel,
  open,
  onToggle,
  onSelect,
  onClose,
}: ModelProviderMenuProps) => {
  const current = providers.find((p) => p.id === value);
  return (
    <div className="composer-sort-root">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="composer-sort-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Filter models by provider"
      >
        <span>{current ? current.name : allLabel}</span>
        <i className="bi bi-chevron-down composer-sort-chevron"></i>
      </button>
      {open && (
        <div className="composer-sort-menu composer-provider-menu" role="listbox">
          <button
            key="__all"
            type="button"
            className={`composer-sort-option ${
              !current ? "composer-sort-option-active" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect("");
              onClose();
            }}
          >
            {allLabel}
          </button>
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`composer-sort-option ${
                current?.id === p.id ? "composer-sort-option-active" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(p.id);
                onClose();
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
