import "server-only";
import { db } from "@/core/db";
export function projectUsers(organizationId: string) {
  return db.member
    .findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    })
    .then((members) => members.map((m) => m.user));
}
export function readDate(value: string | undefined, fallback: Date) {
  return value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
    ? new Date(`${value}T00:00:00Z`)
    : fallback;
}

export async function projectUserOptions(
  organizationId: string,
  selectedIds: string[] = [],
) {
  const [initial, selected] = await Promise.all([
    db.member.findMany({
      where: { organizationId },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
      take: 50,
    }),
    selectedIds.length
      ? db.member.findMany({
          where: { organizationId, userId: { in: selectedIds } },
          select: { user: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);
  return [
    ...new Map(
      [...initial, ...selected].map((member) => [member.user.id, member.user]),
    ).values(),
  ];
}
