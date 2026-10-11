import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";

/** List page: heading with a primary "New" action, then the table. */
export function MasterListPage({
  title,
  description,
  newHref,
  newLabel,
  children,
}: {
  title: string;
  description: string;
  newHref: string;
  newLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeading
        title={title}
        description={description}
        actions={
          <Button asChild>
            <Link href={newHref}>
              <Plus data-icon="inline-start" />
              {newLabel}
            </Link>
          </Button>
        }
      />
      {children}
    </>
  );
}

/**
 * Create/edit page: back link, heading, the form in a card, then optional
 * related sections (`below`, e.g. UrlTabs) rendered under the card.
 */
export function MasterFormPage({
  backHref,
  backLabel,
  title,
  description,
  cardTitle,
  actions,
  below,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  cardTitle: string;
  actions?: ReactNode;
  below?: ReactNode;
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
        <PageHeading
          title={title}
          description={description}
          actions={actions}
        />
      </div>
      <FormCard title={cardTitle}>{children}</FormCard>
      {below}
    </div>
  );
}
