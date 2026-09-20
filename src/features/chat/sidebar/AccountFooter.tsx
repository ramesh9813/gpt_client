import { Link } from "react-router-dom";

interface AccountFooterProps {
  userName?: string | null;
  userEmail?: string | null;
  initial: string;
  isMobile: boolean;
  onCloseDrawer: () => void;
}

export function AccountFooter({
  userName,
  userEmail,
  initial,
  isMobile,
  onCloseDrawer,
}: AccountFooterProps) {
  return (
    <div className="conv-side-footer side-ui-footer">
      <Link
        to="/account"
        className="conv-side-account-link side-ui-account-card"
        onClick={() => {
          if (isMobile) onCloseDrawer();
        }}
      >
        <div className="conv-side-avatar side-ui-avatar">{initial}</div>
        <div className="conv-side-account-info side-ui-account-meta">
          <span className="conv-side-account-name side-ui-account-name">
            {userName || "User"}
          </span>
          <span className="conv-side-account-email side-ui-account-email">
            {userEmail}
          </span>
        </div>
        <span className="side-ui-account-chev" aria-hidden="true">
          <i className="bi bi-chevron-right"></i>
        </span>
      </Link>
    </div>
  );
}
