import Link from "next/link";
import { Card } from "@/components/ui/card";
export function PlatformStats({
  totals,
}: {
  totals: {
    tenants: number;
    active: number;
    suspended: number;
    organizations: number;
    users: number;
  };
}) {
  const stats = [
    {
      label: "Tenants",
      value: totals.tenants,
      detail: `${totals.active} active`,
      href: "/admin/tenants",
    },
    {
      label: "Suspended",
      value: totals.suspended,
      detail: totals.suspended ? "Members are blocked" : "None blocked",
      href: "/admin/tenants",
    },
    {
      label: "Organizations",
      value: totals.organizations,
      detail: "Across all tenants",
    },
    { label: "Users", value: totals.users, detail: "With a sign-in" },
  ];
  return (
    <Card className="grid grid-cols-2 gap-0 divide-y py-0 md:grid-cols-4 md:divide-x md:divide-y-0">
      {stats.map((stat) => {
        const body = (
          <>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {stat.value.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
          </>
        );
        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="p-5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          >
            {body}
          </Link>
        ) : (
          <div key={stat.label} className="p-5">
            {body}
          </div>
        );
      })}
    </Card>
  );
}
