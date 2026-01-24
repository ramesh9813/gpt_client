import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full resize-none rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
