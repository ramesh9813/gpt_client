import type { SortOption } from "./ModelMenu";

export interface ModelSortMenuProps {
  sort: SortOption;
  sortOpen: boolean;
  onToggleSort: () => void;
  onSortChange: (sort: SortOption) => void;
  onCloseSort: () => void;
}

const SORT_LABEL: Record<SortOption, string> = {
  name: "Name",
  cheapest: "Price",
  free: "Free",
  speed: "Speed",
};

/**
 * Model-list sort dropdown (Name/Price/Free/Speed).
 * Split from ModelMenu.tsx. No logic changes.
 */
export const ModelSortMenu = ({
  sort,
  sortOpen,
  onToggleSort,
  onSortChange,
  onCloseSort,
}: ModelSortMenuProps) => {
  return (
    <div className="composer-sort-root">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSort();
        }}
        className="composer-sort-btn"
      >
        <span>{SORT_LABEL[sort]}</span>
        <i className="bi bi-chevron-down composer-sort-chevron"></i>
      </button>
      {sortOpen && (
        <div className="composer-sort-menu">
          {(Object.keys(SORT_LABEL) as SortOption[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`composer-sort-option ${
                sort === s ? "composer-sort-option-active" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSortChange(s);
                onCloseSort();
              }}
            >
              {SORT_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
