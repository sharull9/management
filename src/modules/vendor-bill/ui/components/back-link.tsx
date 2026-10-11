import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      href={href}
    >
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  );
}
