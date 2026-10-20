import { UserFacingError } from "@/core/errors";
import "server-only";
import {
  assertPermission,
  type OrgContext,
  requireOrgContext,
} from "@/core/context";
import { db } from "@/core/db";
import { listParams, pageInfo } from "@/core/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { type AccountReportTotals, amount, buildReports } from "../report-util";
import { reportFiltersInput } from "../schema";

type ReportKind =
  | "ledger"
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "tax";

export async function reportsData(
  org: string,
  rawFilters: unknown = {},
  kind: ReportKind = "ledger",
) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "accounting.view");
  return db.$transaction((tx) => readReports(tx, ctx, rawFilters, kind), {
    isolationLevel: "RepeatableRead",
    timeout: 30000,
    maxWait: 10000,
  });
}

async function readReports(
  tx: Prisma.TransactionClient,
  ctx: OrgContext,
  rawFilters: unknown,
  kind: ReportKind,
) {
  const filters = reportFiltersInput.parse(rawFilters);
  if (
    filters.accountId &&
    !(await tx.ledgerAccount.findFirst({
      where: { id: filters.accountId, organizationId: ctx.org.id },
      select: { id: true },
    }))
  )
    throw new UserFacingError("Account not found in this organization.");
  if (
    filters.projectId &&
    !(await tx.project.findFirst({
      where: { id: filters.projectId, organizationId: ctx.org.id },
      select: { id: true },
    }))
  )
    throw new UserFacingError("Project not found in this organization.");
  const accounts = await tx.ledgerAccount.findMany({
    where: { organizationId: ctx.org.id },
    orderBy: [{ code: "asc" }, { id: "asc" }],
  });
  const reportAccounts = accounts.map(
    ({ id, code, name, type, systemKey }) => ({
      id,
      code,
      name,
      type,
      systemKey,
    }),
  );
  const firstActivity =
    kind === "ledger" && !filters.accountId
      ? await tx.journalLine.findFirst({
          where: {
            organizationId: ctx.org.id,
            journalEntry: {
              organizationId: ctx.org.id,
              status: "POSTED",
              ...(filters.to
                ? { date: { lte: new Date(`${filters.to}T00:00:00.000Z`) } }
                : {}),
            },
            ...(filters.projectId ? { projectId: filters.projectId } : {}),
          },
          orderBy: [{ account: { code: "asc" } }, { accountId: "asc" }],
          select: { accountId: true },
        })
      : null;
  const ledgerAccount =
    reportAccounts.find(
      (account) =>
        account.id === (filters.accountId ?? firstActivity?.accountId),
    ) ?? reportAccounts[0];
  const dateBase: Prisma.JournalLineWhereInput = {
    organizationId: ctx.org.id,
    journalEntry: {
      organizationId: ctx.org.id,
      status: "POSTED",
    },
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(kind === "ledger" && ledgerAccount
      ? { accountId: ledgerAccount.id }
      : {}),
  };
  const from = filters.from
    ? new Date(`${filters.from}T00:00:00.000Z`)
    : undefined;
  const to = filters.to ? new Date(`${filters.to}T00:00:00.000Z`) : undefined;
  const query = (
    date: { lt?: Date; lte?: Date; gte?: Date } = {},
  ): Prisma.JournalLineWhereInput => ({
    ...dateBase,
    journalEntry: {
      organizationId: ctx.org.id,
      status: "POSTED",
      ...(Object.keys(date).length ? { date } : {}),
    },
  });
  const [opening, period, taxGroups] = await Promise.all([
    from && (kind === "ledger" || kind === "trial-balance")
      ? tx.journalLine.groupBy({
          by: ["accountId"],
          where: query({ lt: from }),
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve([]),
    kind !== "tax"
      ? tx.journalLine.groupBy({
          by: ["accountId"],
          where: query({
            ...(from && kind !== "balance-sheet" ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }),
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve([]),
    kind === "tax"
      ? tx.journalLine.groupBy({
          by: ["taxComponentId", "taxName", "taxRate", "accountId"],
          where: {
            ...query({
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            }),
            taxComponentId: { not: null },
          },
          _sum: { debit: true, credit: true, taxBaseAmount: true },
        })
      : Promise.resolve([]),
  ]);
  const indexed = <T extends { accountId: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.accountId, row]));
  const openingByAccount = indexed(opening),
    periodByAccount = indexed(period);
  const totalsByAccount = new Map<string, AccountReportTotals>(
    accounts.map((account) => {
      const o = openingByAccount.get(account.id)?._sum;
      const p = periodByAccount.get(account.id)?._sum;
      return [
        account.id,
        {
          openingDebit: o?.debit ?? "0",
          openingCredit: o?.credit ?? "0",
          periodDebit: p?.debit ?? "0",
          periodCredit: p?.credit ?? "0",
          throughDebit: amount(o?.debit ?? "0").add(amount(p?.debit ?? "0")),
          throughCredit: amount(o?.credit ?? "0").add(amount(p?.credit ?? "0")),
        },
      ];
    }),
  );
  const page = listParams(
    rawFilters as Record<string, string | string[] | undefined>,
  );
  const ledgerWhere =
    kind === "ledger" && ledgerAccount
      ? {
          ...query({
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }),
          accountId: ledgerAccount.id,
        }
      : null;
  const ledgerTotal = ledgerWhere
    ? await tx.journalLine.count({ where: ledgerWhere })
    : 0;
  const pagination = pageInfo(ledgerTotal, page);
  const ledgerPage = pagination.page;
  const ledgerLines = ledgerWhere
    ? await tx.journalLine.findMany({
        where: ledgerWhere,
        select: {
          id: true,
          debit: true,
          credit: true,
          taxComponentId: true,
          taxName: true,
          taxRate: true,
          taxBaseAmount: true,
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              systemKey: true,
            },
          },
          journalEntry: {
            select: { id: true, code: true, date: true, description: true },
          },
        },
        orderBy: [
          { journalEntry: { date: "asc" } },
          { journalEntry: { code: "asc" } },
          { id: "asc" },
        ],
        skip: (ledgerPage - 1) * page.pageSize,
        take: page.take,
      })
    : [];
  const firstLedgerLine = ledgerLines[0];
  const priorLedgerTotal =
    ledgerWhere && firstLedgerLine
      ? await tx.journalLine.aggregate({
          where: {
            ...ledgerWhere,
            OR: [
              {
                journalEntry: {
                  date: { lt: firstLedgerLine.journalEntry.date },
                },
              },
              {
                journalEntry: {
                  date: firstLedgerLine.journalEntry.date,
                  code: { lt: firstLedgerLine.journalEntry.code },
                },
              },
              {
                journalEntry: {
                  date: firstLedgerLine.journalEntry.date,
                  code: firstLedgerLine.journalEntry.code,
                },
                id: { lt: firstLedgerLine.id },
              },
            ],
          },
          _sum: { debit: true, credit: true },
        })
      : null;
  const taxRowsAsLines = taxGroups
    .map((group, i) => ({
      id: `tax-${i}`,
      debit: group._sum?.debit ?? "0",
      credit: group._sum?.credit ?? "0",
      taxComponentId: group.taxComponentId,
      taxName: group.taxName,
      taxRate: group.taxRate,
      taxBaseAmount: group._sum?.taxBaseAmount ?? "0",
      account: reportAccounts.find((a) => a.id === group.accountId),
      journalEntry: {
        id: `aggregate-${i}`,
        code: "",
        date: from ?? to ?? new Date(0),
        description: "",
      },
    }))
    .filter(
      (
        line,
      ): line is typeof line & { account: NonNullable<typeof line.account> } =>
        Boolean(line.account),
    );
  const lines = [
    ...ledgerLines.map((line) => ({
      ...line,
      taxComponentId: null,
      taxName: null,
      taxRate: null,
      taxBaseAmount: null,
    })),
    ...taxRowsAsLines,
  ];
  const ledgerOpening = ledgerAccount
    ? (() => {
        const t = totalsByAccount.get(ledgerAccount.id);
        if (!t) return amount("0");
        return ["ASSET", "EXPENSE"].includes(ledgerAccount.type)
          ? amount(t.openingDebit).sub(amount(t.openingCredit))
          : amount(t.openingCredit).sub(amount(t.openingDebit));
      })()
    : amount("0");
  const priorBalance = priorLedgerTotal
    ? ["ASSET", "EXPENSE"].includes(ledgerAccount?.type ?? "ASSET")
      ? amount(priorLedgerTotal._sum?.debit ?? "0").sub(
          amount(priorLedgerTotal._sum?.credit ?? "0"),
        )
      : amount(priorLedgerTotal._sum?.credit ?? "0").sub(
          amount(priorLedgerTotal._sum?.debit ?? "0"),
        )
    : amount("0");
  const totals = buildReports({
    accounts: reportAccounts,
    lines,
    from,
    to,
    accountId: ledgerAccount?.id,
    totalsByAccount,
    ledgerOpeningBalance: ledgerOpening,
    ledgerRowStartingBalance: ledgerOpening.add(priorBalance),
  });
  return {
    ctx,
    accounts,
    filters,
    ...totals,
    ledger: {
      ...totals.ledger,
      closingBalance: (() => {
        const total = ledgerAccount
          ? totalsByAccount.get(ledgerAccount.id)
          : null;
        if (!total || !ledgerAccount) return totals.ledger.closingBalance;
        const net = ["ASSET", "EXPENSE"].includes(ledgerAccount.type)
          ? amount(total.periodDebit).sub(amount(total.periodCredit))
          : amount(total.periodCredit).sub(amount(total.periodDebit));
        return ledgerOpening.add(net).toFixed(2);
      })(),
      total: ledgerTotal,
      page: ledgerPage,
      pageSize: page.pageSize,
    },
  };
}
