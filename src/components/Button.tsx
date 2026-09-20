import { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";
import "./Button.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "destructive";
};

const base = "btn";

const variants: Record<string, string> = {
  primary: "btn-primary",
  outline: "btn-outline",
  ghost: "btn-ghost",
  destructive: "btn-destructive"
};

export const Button = ({ variant = "primary", className, ...props }: Props) => (
  <button className={cn(base, variants[variant], className)} {...props} />
);
