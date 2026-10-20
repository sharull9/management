import "server-only";
import { db } from "@/core/db";
import { type ListParams, listParams, pageInfo } from "@/core/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { financeScope, visiblePaymentRow } from "./finance-scope";
import {
  paymentOrderBy,
  paymentScopeWhere,
  paymentSearchWhere,
  paymentSortKeys,
  requestSearchWhere,
  scopedAnd,
} from "./list-query-helpers";

function dateFilter(params: ListParams) {
  const parse = (value: string | string[] | undefined, end: boolean) => {
    const selected = Array.isArray(value) ? value[0] : value;
    if (typeof selected !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(selected))
      return undefined;
    const date = new Date(
      `${selected}T${end ? "23:59:59.999" : "00:00:00.000"}Z`,
    );
    return Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== selected
      ? undefined
      : date;
  };
  const start = parse(params.dateFrom, false);
  const end = parse(params.dateTo, true);
  return start || end
    ? {
        date: {
          ...(start ? { gte: start } : {}),
          ...(end ? { lte: end } : {}),
        },
      }
    : {};
}

function firstParam(params: ListParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export async function paymentListData(
  org: string,
  params: ListParams = {},
  permission = "payment.view",
  projectId?: string,
  receipts = false,
) {
  const scope = await financeScope(org, permission, projectId);
  const input = listParams(params);
  const statuses = (
    Array.isArray(params.status) ? params.status : [params.status]
  )
    .flatMap((value) => (value ?? "").split(","))
    .filter(
      (value): value is "POSTED" | "VOID" =>
        value === "POSTED" || value === "VOID",
    );
  const directionParam = firstParam(params, "direction");
  const direction: "INCOMING" | "OUTGOING" | undefined =
    directionParam === "INCOMING" || directionParam === "OUTGOING"
      ? directionParam
      : undefined;
  const currencyParam = firstParam(params, "currency");
  const currency =
    typeof currencyParam === "string" &&
    /^[A-Za-z0-9_-]{1,10}$/.test(currencyParam)
      ? currencyParam
      : undefined;
  const paymentScope = paymentScopeWhere(
    scope.ctx.org.id,
    scope.ids,
    scope.canViewOrg,
    projectId,
    scope.scopedWhere,
  );
  const dateCondition = dateFilter(params);
  const where: Prisma.PaymentWhereInput = {
    ...scopedAnd(
      paymentScope,
      paymentSearchWhere(input.search, scope.canViewOrg),
      ...(dateCondition.date ? [{ date: dateCondition.date }] : []),
    ),
    ...(receipts ? { direction: "INCOMING" as const } : {}),
    ...(direction && !receipts ? { direction } : {}),
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(currency ? { currency } : {}),
  };
  const sortKeys = scope.canViewOrg
    ? paymentSortKeys
    : paymentSortKeys.filter((key) => key !== "project");
  const orderBy = paymentOrderBy(
    sortKeys.includes(input.sort) ? input.sort : "date",
    input.direction,
  );
  const [total, baseCurrency] = await Promise.all([
    db.payment.count({ where }),
    db.currency.findUniqueOrThrow({
      where: { code: scope.ctx.org.baseCurrency },
      select: { code: true, decimals: true },
    }),
  ]);
  const info = pageInfo(total, input);
  const rows = await db.payment.findMany({
    where,
    include: { party: true, project: { select: { id: true, name: true } } },
    orderBy: [orderBy, { id: input.direction }],
    skip: (info.page - 1) * input.pageSize,
    take: input.take,
  });
  return {
    ...scope,
    rows: rows.map((payment) => visiblePaymentRow(payment, scope)),
    page: { ...info, sortKeys },
    baseCurrency,
  };
}

export async function requestListData(
  org: string,
  params: ListParams = {},
  projectId?: string,
) {
  const scope = await financeScope(org, "payment.view", projectId);
  const input = listParams(params);
  const allowedStatuses = [
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "PAID",
    "CANCELLED",
  ] as const;
  const statuses = (
    Array.isArray(params.status) ? params.status : [params.status]
  )
    .flatMap((value) => (value ?? "").split(","))
    .filter((value): value is (typeof allowedStatuses)[number] =>
      allowedStatuses.includes(value as (typeof allowedStatuses)[number]),
    );
  const currencyParam = firstParam(params, "currency");
  const currency =
    typeof currencyParam === "string" &&
    /^[A-Za-z0-9_-]{1,10}$/.test(currencyParam)
      ? currencyParam
      : undefined;
  const dateCondition = dateFilter(params);
  const where: Prisma.PaymentRequestWhereInput = {
    ...scopedAnd(
      scope.scopedWhere,
      requestSearchWhere(input.search, scope.ids),
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
      ...(currency ? [{ currency }] : []),
      ...(dateCondition.date ? [{ date: dateCondition.date }] : []),
    ),
  };
  const orderBy =
    input.sort === "code"
      ? { code: input.direction }
      : input.sort === "party"
        ? { party: { displayName: input.direction } }
        : input.sort === "project"
          ? { project: { name: input.direction } }
          : input.sort === "status"
            ? { status: input.direction }
            : { date: input.direction };
  const total = await db.paymentRequest.count({ where });
  const info = pageInfo(total, input);
  const pageRows = await db.paymentRequest.findMany({
    where,
    include: {
      party: true,
      project: { select: { id: true, name: true } },
      bills: {
        where: { bill: { projectId: { in: scope.ids } } },
        include: { bill: { select: { id: true, code: true } } },
      },
    },
    orderBy: [orderBy, { id: input.direction }],
    skip: (info.page - 1) * input.pageSize,
    take: input.take,
  });
  return {
    ...scope,
    rows: pageRows,
    page: { ...info, sortKeys: paymentSortKeys },
  };
}
