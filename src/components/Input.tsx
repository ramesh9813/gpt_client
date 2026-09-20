import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "../lib/utils";
import "./Input.css";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "input",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";
