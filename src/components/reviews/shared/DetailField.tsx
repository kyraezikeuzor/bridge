import type { ReactNode } from "react";

type DetailFieldProps = {
  label: string;
  value?: string | number | null;
  emphasize?: boolean;
  children?: ReactNode;
};

export function DetailField({
  label,
  value,
  emphasize = false,
  children,
}: DetailFieldProps) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children ?? (
        <p
          className={
            emphasize
              ? "text-lg font-bold text-foreground"
              : "text-sm text-foreground"
          }
        >
          {value === null || value === undefined || value === "" ? "—" : value}
        </p>
      )}
    </div>
  );
}
