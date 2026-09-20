import { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";
import "./IconButton.css";

export const IconButton = ({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "icon-btn",
      className
    )}
    {...props}
  />
);
