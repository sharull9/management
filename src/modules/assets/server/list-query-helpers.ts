import type { Prisma } from "@/generated/prisma/client";

export const assetSortKeys = ["name", "code", "type", "active"];
export const historySortKeys = ["date"];

export function assetListWhere(
  organizationId: string,
  projectId: string | undefined,
  type: "VEHICLE" | "MACHINE" | undefined,
  active: boolean | undefined,
  search: string,
) {
  return {
    organizationId,
    ...(projectId ? { allocations: { some: { projectId } } } : {}),
    ...(type ? { type } : {}),
    ...(active !== undefined ? { active } : {}),
    ...assetSearchWhere(search),
  };
}

export function assetSearchWhere(search: string) {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { code: { contains: search, mode: "insensitive" as const } },
    ],
  };
}

export function assetOrderBy(
  sort: string,
  direction: "asc" | "desc",
): Prisma.AssetOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: direction }];
    case "code":
      return [{ code: direction }];
    case "type":
      return [{ type: direction }];
    case "active":
      return [{ active: direction }];
    default:
      return [{ active: "desc" }, { name: "asc" }];
  }
}

export function historySearchWhere(search: string) {
  return search
    ? { project: { name: { contains: search, mode: "insensitive" as const } } }
    : {};
}
