import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-on-primary shadow-sm",
  secondary: "bg-transparent border border-primary text-primary",
  tertiary: "bg-transparent text-primary underline-offset-4 hover:underline",
};

export function Button({ variant = "primary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`px-lg py-sm rounded-lg font-label-lg text-label-lg transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${variantClasses[variant]} ${className ?? ""}`}
      disabled={disabled}
      {...props}
    />
  );
}
