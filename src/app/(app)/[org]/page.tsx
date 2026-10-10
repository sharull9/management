import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { requireOrgContext } from "@/server/context";

async function Dashboard({ params }: { params: Promise<{ org: string }> }) {
  const ctx = await requireOrgContext((await params).org);
  return (
    <>
      <PageHeading
        title={ctx.org.name}
        description="Your organization workspace is ready. Configure members, approvals and numbering before starting project work."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <FormCard title="Organization">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <dt className="text-muted-foreground">Tenant</dt>
            <dd>{ctx.tenant.name}</dd>
            <dt className="text-muted-foreground">Legal name</dt>
            <dd>{ctx.org.legalName ?? "Not set"}</dd>
            <dt className="text-muted-foreground">Currency</dt>
            <dd>{ctx.org.baseCurrency}</dd>
            <dt className="text-muted-foreground">Your access</dt>
            <dd>
              <Badge variant="secondary">
                {ctx.tenantRole === "MEMBER"
                  ? ctx.member?.role
                  : ctx.tenantRole}
              </Badge>
            </dd>
          </dl>
        </FormCard>
        <FormCard title="Projects and costing">
          <p className="text-sm text-muted-foreground">
            Projects, stages, tasks, workforce and the cost ledger will arrive
            in Phase 2.
          </p>
        </FormCard>
      </div>
    </>
  );
}

export default function Page(props: Parameters<typeof Dashboard>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard {...props} />
    </Suspense>
  );
}
