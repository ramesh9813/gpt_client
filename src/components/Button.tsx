import { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
};

const base =
  "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<string, string> = {
  primary: "bg-[var(--accent)] text-black hover:opacity-90",
  outline:
    "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--panel)]",
  ghost: "text-[var(--text)] hover:bg-[var(--panel)]"
};

export const Button = ({ variant = "primary", className, ...props }: Props) => (
  <button className={cn(base, variants[variant], className)} {...props} />
);