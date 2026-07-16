import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { MaterialIcon } from "./MaterialIcon";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** Leading icon inside the field, e.g. "person", "phone_android", "vpn_key". */
  icon?: string;
  /** Rendered next to the label, right-aligned — e.g. an "Optional" badge or a "Forgot password?" link. */
  labelSuffix?: ReactNode;
  /** Rendered inside the field on the right, e.g. a password show/hide toggle. */
  trailingAction?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, icon, labelSuffix, trailingAction, id, className, ...props },
  ref
) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center justify-between">
        <label htmlFor={fieldId} className="text-label-lg font-label-lg text-text-primary">
          {label}
        </label>
        {labelSuffix}
      </div>
      <div className="relative flex items-center">
        {icon && (
          <MaterialIcon name={icon} className="absolute left-3 text-outline text-[20px] pointer-events-none" />
        )}
        <input
          id={fieldId}
          ref={ref}
          className={`w-full py-sm rounded-lg border bg-surface-container-lowest text-body-md font-body-md text-text-primary
            ${icon ? "pl-10" : "pl-md"} ${trailingAction ? "pr-10" : "pr-md"}
            ${error ? "border-error-red" : "border-outline-variant"}
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${className ?? ""}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...props}
        />
        {trailingAction && <div className="absolute right-3">{trailingAction}</div>}
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-label-md font-label-md text-error-red">
          {error}
        </p>
      )}
    </div>
  );
});
