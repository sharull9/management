import { notFound, redirect } from "next/navigation";
import { requireProjectContext } from "@/core/context";
import { requestFormData } from "../../server/form-queries";
import { RequestForm } from "../components/request-form";
import { RequestFormPage } from "../components/request-form-page";
import { date, money } from "../util";

export async function RequestEditView({
  org,
  id,
}: {
  org: string;
  id: string;
}) {
  const { ctx: orgCtx, data, draft: row } = await requestFormData(org, id);
  if (!row) notFound();
  const detail = `/${org}/finance/payment-requests/${id}`;
  if (row.status !== "DRAFT") redirect(detail);
  const ctx = row.projectId
    ? await requireProjectContext(org, row.projectId)
    : orgCtx;
  if (!ctx.isAdmin && !ctx.permissions.has("payment.request.create"))
    redirect(detail);
  return (
    <RequestFormPage
      backHref={detail}
      backLabel={row.code}
      title={`Edit ${row.code}`}
      description="Only draft requests can be edited."
    >
      <RequestForm
        org={org}
        data={data}
        draft={{
          id: row.id,
          partyId: row.partyId,
          projectId: row.projectId,
          date: date(row.date),
          amount: money(row.amount),
          currency: row.currency,
          exchangeRate: row.exchangeRate.toString(),
          mode: row.mode,
          purpose: row.purpose,
          reason: row.reason,
          allocations: row.bills.map((b) => ({
            documentId: b.billId,
            amount: money(b.amount),
            code:
              data.bills.find((bill) => bill.id === b.billId)?.code ?? b.billId,
          })),
        }}
      />
    </RequestFormPage>
  );
}
