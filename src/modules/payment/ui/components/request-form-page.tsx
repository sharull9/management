import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";

/** Create/edit page: back link, heading, then the form in a card. */
export function RequestFormPage({
  backHref,
  backLabel,
  title,
  description,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          href={backHref}
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <PageHeading title={title} description={description} />
      </div>
      <FormCard title="Request details">{children}</FormCard>
    </div>
  );
}
