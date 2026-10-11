import type { MasterData } from "../type";

type CategoryRow = MasterData["categories"][number];

/** Full "Parent / Child" path of a category. */
export function categoryPath(
  categories: CategoryRow[],
  categoryId: string,
): string {
  const c = categories.find((c) => c.id === categoryId);
  return c
    ? `${c.parentId ? `${categoryPath(categories, c.parentId)} / ` : ""}${c.name}`
    : "";
}
