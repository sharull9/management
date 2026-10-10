import { Suspense } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import Loading from "@/components/shared/page-loading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { saveSeriesAction } from "@/server/actions";

async function NumberingPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
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
      <div className="space-y-4">
        {series.map((s) => (
          <FormCard
            key={s.id}
            title={`${s.type} · ${s.prefix}${String(s.nextNumber).padStart(s.padding, "0")}`}
          >
            <ActionForm action={saveSeriesAction.bind(null, org)}>
              <input type="hidden" name="type" value={s.type} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Prefix" name="prefix" defaultValue={s.prefix} />
                <Field
                  label="Padding"
                  name="padding"
                  type="number"
                  min={1}
                  max={12}
                  defaultValue={s.padding}
                  required
                />
                <Field
                  label="Next number"
                  name="nextNumber"
                  type="number"
                  min={s.nextNumber}
                  defaultValue={s.nextNumber}
                  required
                />
              </div>
            </ActionForm>
          </FormCard>
        ))}
      </div>
      <FormCard title="Add document series">
        <ActionForm
          action={saveSeriesAction.bind(null, org)}
          submit="Add series"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Document type"
              name="type"
              placeholder="PROJECT"
              required
            />
            <Field label="Prefix" name="prefix" placeholder="PRJ-" />
            <Field
              label="Padding"
              name="padding"
              type="number"
              min={1}
              max={12}
              defaultValue={4}
              required
            />
            <Field
              label="Next number"
              name="nextNumber"
              type="number"
              min={1}
              defaultValue={1}
              required
            />
          </div>
        </ActionForm>
      </FormCard>
    </>
  );
}

export default function Page(props: Parameters<typeof NumberingPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <NumberingPage {...props} />
    </Suspense>
  );
}
