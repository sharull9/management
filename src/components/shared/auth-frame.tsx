import { HardHat } from "lucide-react";
import type { ReactNode } from "react";

/** Centered, branded frame for sign-in and first-run setup screens. */
export function AuthFrame({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-svh flex-1 items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]"
      />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_24px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
            <HardHat className="size-5" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-pretty text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {children}
        </div>
        {footer && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
