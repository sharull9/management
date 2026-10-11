import "server-only";
import { db } from "@/core/db";

const PLATFORM_ENTITIES = ["Tenant", "Organization", "User"];

export async function listTenants() {
  return db.tenant.findMany({
    include: {
      organizations: { orderBy: { name: "asc" } },
      members: {
        where: { role: "OWNER" },
        include: { user: { select: { name: true, email: true } } },
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPlatformOverview() {
  const [
    statusCounts,
    organizations,
    users,
    tenantsWithoutOrgs,
    suspended,
    newest,
    activity,
  ] = await Promise.all([
    db.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    db.organization.count(),
    db.user.count(),
    db.tenant.findMany({
      where: { status: "ACTIVE", organizations: { none: {} } },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.tenant.findMany({
      where: { status: "SUSPENDED" },
      select: { id: true, name: true, slug: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.tenant.findMany({
      include: {
        _count: { select: { organizations: true, members: true } },
        members: {
          where: { role: "OWNER" },
          include: { user: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.auditLog.findMany({
      where: { entityType: { in: PLATFORM_ENTITIES } },
      include: {
        user: { select: { name: true } },
        tenant: { select: { name: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const count = (status: "ACTIVE" | "SUSPENDED") =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;
  return {
    totals: {
      tenants: count("ACTIVE") + count("SUSPENDED"),
      active: count("ACTIVE"),
      suspended: count("SUSPENDED"),
      organizations,
      users,
    },
    tenantsWithoutOrgs,
    suspended,
    newest,
    activity,
  };
}
