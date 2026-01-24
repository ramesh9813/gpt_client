import { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export const IconButton = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)]",
      className
    )}
    {...props}
  />
);