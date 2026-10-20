export type ListParams = Record<string, string | string[] | undefined>;
export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  sortKeys?: string[];
};

export function listParams(params: ListParams = {}, pageSize = 25) {
  const first = (name: string) => {
    const value = params[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const input = first("page") ?? "1";
  const page = /^\d{1,6}$/.test(input) ? Math.max(1, Number(input)) : 1;
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    search: (first("search") ?? "").trim().slice(0, 150),
    sort: (first("sort") ?? "").slice(0, 100),
    direction:
      (first("sortDirection") ?? first("direction")) === "asc"
        ? ("asc" as const)
        : ("desc" as const),
  };
}

export function pageInfo(
  total: number,
  input: { page: number; pageSize: number },
): PageInfo {
  return {
    page: Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize))),
    pageSize: input.pageSize,
    total,
  };
}
