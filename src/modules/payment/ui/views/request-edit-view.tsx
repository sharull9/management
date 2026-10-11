import { notFound, redirect } from "next/navigation";
import { requireProjectContext } from "@/core/context";
import { financeData } from "../../server/queries";
import { RequestForm } from "../components/request-form";
import { RequestFormPage } from "../components/request-form-page";
import { date, formData, money } from "../util";

export async function RequestEditView({
  org,
  id,
}: {
  org: string;
  id: string;
}) {
  const d = await financeData(org, "payment.request.create"),
    row = d.requests.find((r) => r.id === id);
  if (!row) notFound();
  const detail = `/${org}/finance/payment-requests/${id}`;
  if (row.status !== "DRAFT") redirect(detail);
  const ctx = row.projectId
    ? await requireProjectContext(org, row.projectId)
    : d.ctx;
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
        data={formData(d)}
        draft={{
          id: row.id,
          partyId: row.partyId,
          projectId: row.projectId,
          date: date(row.date),
          amount: money(row.amount),
          mode: row.mode,
          purpose: row.purpose,
          reason: row.reason,
          allocations: row.bills.map((b) => ({
            documentId: b.billId,
            amount: money(b.amount),
            code:
              d.bills.find((bill) => bill.id === b.billId)?.code ?? b.billId,
          })),
        }}
      />
    </RequestFormPage>
  );
}
