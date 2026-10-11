import { ArrowRight, Building2, CircleAlert, History } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSuperAdmin } from "@/core/context";
import { getPlatformOverview } from "../../server/queries";
import { ActivityList } from "../components/activity-list";
import { PlatformStats } from "../components/platform-stats";
import { CreateTenantDialog } from "../components/tenant-forms";
import { TenantStatusBadge } from "../components/tenant-status-badge";
export async function AdminView() {
  const user = await requireSuperAdmin();
  const overview = await getPlatformOverview();
  const attention = [
    ...overview.suspended.map((tenant) => ({
      ...tenant,
      reason: "Suspended. Members can't sign in to its organizations.",
    })),
    ...overview.tenantsWithoutOrgs.map((tenant) => ({
      ...tenant,
      reason: "No organization yet. The owner hasn't finished setup.",
    })),
  ];
  return (
    <>
      <PageHeading
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="What's happening across every tenant on the platform."
        actions={<CreateTenantDialog />}
      />
      <PlatformStats totals={overview.totals} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Newest tenants</CardTitle>
            <CardDescription>The five most recently created.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/tenants">
                  All tenants
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {overview.newest.length ? (
              <ul className="divide-y">
                {overview.newest.map((tenant) => (
                  <li
                    key={tenant.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{tenant.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tenant.members[0]?.user.name ?? "No owner"},{" "}
                        {tenant._count.organizations}{" "}
                        {tenant._count.organizations === 1
                          ? "organization"
                          : "organizations"}
                      </p>
                    </div>
                    <TenantStatusBadge status={tenant.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Building2 />}
                title="No tenants yet"
                description="Create the first tenant to give a customer access."
                action={<CreateTenantDialog variant="outline" />}
              />
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>
              Tenants that are blocked or not set up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attention.length ? (
              <ul className="space-y-3">
                {attention.map((tenant) => (
                  <li
                    key={`${tenant.id}-${tenant.reason}`}
                    className="flex gap-3"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {tenant.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every tenant is active and set up.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>
            Tenant, organization and user changes across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.activity.length ? (
            <ActivityList
              entries={overview.activity.map((entry) => ({
                id: entry.id,
                action: entry.action,
                entityType: entry.entityType,
                actor: entry.user?.name ?? "System",
                subject: entry.tenant?.name ?? entry.organization?.name,
                createdAt: entry.createdAt,
              }))}
            />
          ) : (
            <EmptyState
              icon={<History />}
              title="No activity yet"
              description="Changes to tenants and organizations appear here."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
