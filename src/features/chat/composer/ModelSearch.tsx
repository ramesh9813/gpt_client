import { Input } from "../../../components/Input";

export interface ModelSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}

/**
 * Reusable model search field for dropdowns: search icon, autofocus input
 * (Enter never bubbles to the composer), and a clear button.
 * Styles live with the model picker (ComposerModelPicker.css).
 */
export const ModelSearch = ({
  value,
  onChange,
  placeholder = "Search models...",
  ariaLabel = "Search models",
  autoFocus = true,
}: ModelSearchProps) => {
  return (
    <div className="composer-query-wrap">
      <div className="composer-query-box">
        <i className="bi bi-search composer-query-icon" aria-hidden="true"></i>
        <Input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="composer-query-input"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear model search"
            title="Clear"
            className="composer-query-clear"
          >
            <i className="bi bi-x composer-clear-icon" aria-hidden="true"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default ModelSearch;
