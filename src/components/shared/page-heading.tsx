import type { ReactNode } from "react";
export function PageHeading({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <p className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
