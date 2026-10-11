import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { SeriesForm } from "../components/series-form";

export async function NumberingView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "settings.manage");
  const series = await db.documentSeries.findMany({
    where: { organizationId: ctx.org.id },
    orderBy: { type: "asc" },
  });
  return (
    <>
      <PageHeading
        title="Document numbering"
        description="Each organization has its own document counters. Numbers are allocated atomically; counters cannot move backwards."
      />
      {!series.length && <EmptyState title="No document series yet." />}
      <div className="space-y-4">
        {series.map((s) => (
          <FormCard
            key={s.id}
            title={`${s.type} · ${s.prefix}${String(s.nextNumber).padStart(s.padding, "0")}`}
          >
            <SeriesForm
              org={org}
              series={{
                type: s.type,
                prefix: s.prefix,
                padding: s.padding,
                nextNumber: s.nextNumber,
              }}
            />
          </FormCard>
        ))}
      </div>
      <FormCard title="Add document series">
        <SeriesForm org={org} />
      </FormCard>
    </>
  );
}
