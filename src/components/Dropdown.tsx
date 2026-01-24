import { ReactNode } from "react";
import { cn } from "../lib/utils";

export const Dropdown = ({
  open,
  children,
  align = "end",
  placement = "bottom",
  className
}: {
  open: boolean;
  children: ReactNode;
  align?: "start" | "end";
  placement?: "top" | "bottom";
  className?: string;
}) => {
  if (!open) return null;
  const alignClass = align === "start" ? "left-0" : "right-0";
  const placementClass =
    placement === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <div
      className={cn(
        "absolute z-20 w-40 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1 shadow-lg",
        alignClass,
        placementClass,
        className
      )}
    >
      {children}
    </div>
  );
};
