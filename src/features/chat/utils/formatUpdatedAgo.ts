/**
 * Format a "time ago" label for the model-catalog footer.
 *
 * Seconds -> "just now", minutes -> "Nm ago", hours -> "Nh ago",
 * days -> "Nd ago". Returns "unknown" for missing/unparseable input.
 */
export function formatUpdatedAgo(
  updatedAt: string | null | undefined,
  nowMs?: number
): string {
  if (!updatedAt) return "unknown";
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) return "unknown";

  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));

  if (diffSec < 60) return "just now";

  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default formatUpdatedAgo;
