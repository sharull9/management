export const procurementSortKeys = ["code", "project", "status", "date"];

export function procurementSearchWhere(search: string, kind: string) {
  search = search.trim();
  if (!search) return {};
  return {
    OR: [
      { code: { contains: search, mode: "insensitive" as const } },
      { project: { name: { contains: search, mode: "insensitive" as const } } },
      ...(kind === "transfers"
        ? [
            {
              toProject: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          ]
        : []),
    ],
  };
}

export function procurementOrderBy(sort: string, direction: "asc" | "desc") {
  switch (sort) {
    case "code":
      return { code: direction };
    case "project":
      return { project: { name: direction } };
    case "status":
      return { status: direction };
    default:
      return { createdAt: direction };
  }
}
