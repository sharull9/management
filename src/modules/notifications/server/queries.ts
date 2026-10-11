"use server";
import { requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { notificationScope } from "../schema";

export async function listNotifications(input: { orgSlug: string }) {
  const { orgSlug } = notificationScope.parse(input);
  const ctx = await requireOrgContext(orgSlug);
  const where = {
    tenantId: ctx.tenant.id,
    organizationId: ctx.org.id,
    userId: ctx.user.id,
  };
  const [latest, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, body: true, href: true, readAt: true },
    }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return {
    unreadCount,
    latest: latest.map(({ readAt, ...row }) => ({
      ...row,
      read: readAt !== null,
    })),
  };
}
