import { forwardRef, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/utils";
import "./Textarea.css";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "textarea",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
