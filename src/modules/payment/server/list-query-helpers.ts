import type { Prisma } from "@/generated/prisma/client";

export const paymentSortKeys = ["code", "party", "project", "date", "status"];

export function scopedAnd<T extends readonly unknown[]>(
  ...conditions: T
): { AND: T[number][] } {
  return { AND: [...conditions] };
}

export function paymentScopeWhere(
  organizationId: string,
  ids: string[],
  canViewOrg: boolean,
  projectId?: string,
  orgScope?: Prisma.PaymentWhereInput,
): Prisma.PaymentWhereInput {
  if (projectId)
    return {
      organizationId,
      OR: [
        { projectId },
        {
          allocations: {
            some: {
              OR: [
                { vendorBill: { projectId } },
                { salesInvoice: { projectId } },
              ],
            },
          },
        },
      ],
    };
  if (canViewOrg) return orgScope ?? { organizationId };
  return {
    organizationId,
    OR: [
      { projectId: { in: ids } },
      {
        allocations: {
          some: {
            OR: [
              { vendorBill: { projectId: { in: ids } } },
              { salesInvoice: { projectId: { in: ids } } },
            ],
          },
        },
      },
    ],
  };
}

export function paymentSearchWhere(search: string, canSearchProject = true) {
  if (!search) return {};
  return {
    OR: [
      { code: { contains: search, mode: "insensitive" as const } },
      {
        party: {
          displayName: { contains: search, mode: "insensitive" as const },
        },
      },
      ...(canSearchProject
        ? [
            {
              project: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          ]
        : []),
    ],
  };
}

export function paymentOrderBy(sort: string, direction: "asc" | "desc") {
  switch (sort) {
    case "code":
      return { code: direction };
    case "party":
      return { party: { displayName: direction } };
    case "project":
      return { project: { name: direction } };
    case "status":
      return { status: direction };
    default:
      return { date: direction };
  }
}

export function requestSearchWhere(
  search: string,
  visibleProjectIds?: string[],
) {
  if (!search) return {};
  return {
    OR: [
      { code: { contains: search, mode: "insensitive" as const } },
      {
        party: {
          displayName: { contains: search, mode: "insensitive" as const },
        },
      },
      { project: { name: { contains: search, mode: "insensitive" as const } } },
      ...(visibleProjectIds?.length
        ? [
            {
              bills: {
                some: {
                  bill: {
                    AND: [
                      {
                        code: {
                          contains: search,
                          mode: "insensitive" as const,
                        },
                      },
                      { projectId: { in: visibleProjectIds } },
                    ],
                  },
                },
              },
            },
          ]
        : []),
    ],
  };
}
