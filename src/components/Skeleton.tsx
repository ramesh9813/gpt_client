export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-[var(--panel)] ${className}`} />
);