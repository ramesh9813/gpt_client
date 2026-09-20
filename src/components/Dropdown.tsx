import { ReactNode } from "react";
import { cn } from "../lib/utils";
import "./Dropdown.css";

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
  const alignClass = align === "start" ? "dropdown-align-start" : "dropdown-align-end";
  const placementClass =
    placement === "top" ? "dropdown-placement-top" : "dropdown-placement-bottom";
  return (
    <div
      className={cn(
        "dropdown",
        alignClass,
        placementClass,
        className
      )}
    >
      {children}
    </div>
  );
};
