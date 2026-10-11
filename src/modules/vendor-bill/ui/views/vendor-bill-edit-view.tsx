import { notFound } from "next/navigation";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { billDetail, billOptions } from "../../server/queries";
import type { BillDraftLine } from "../../type";
import { BackLink } from "../components/back-link";
import { BillForm } from "../components/vendor-bill-form";

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";

export async function BillEdit({
  org,
  billId,
}: {
  org: string;
  billId: string;
}) {
  const { ctx, row } = await billDetail(org, billId);
  const canEdit =
    row.status === "DRAFT" &&
    (ctx.isAdmin || ctx.permissions.has("bill.create"));
  if (!canEdit) notFound();
  const data = await billOptions(org, row.id);
  const initialLines: BillDraftLine[] = row.lines.map((l) => ({
    poLineId: l.poLineId,
    grnLineId: l.grnLineId,
    itemVariantId: l.itemVariantId,
    description: l.description,
    qty: l.qty.toString(),
    uomId: l.uomId,
    rate: l.rate.toString(),
    discountPercent: l.discountPercent.toString(),
    taxGroupId: l.taxGroupId,
    poRate: l.poRate?.toString() ?? null,
    receiptName: l.grnLine?.receipt.code,
  }));
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackLink href={`/${org}/procurement/bills/${row.id}`}>
          Back to {row.code}
        </BackLink>
        <PageHeading
          eyebrow={row.code}
          title="Edit draft bill"
          description="Update the draft, then save to return to the bill."
        />
      </div>
      <FormCard title="Bill details">
        <BillForm
          org={org}
          data={data}
          initial={{
            id: row.id,
            projectId: row.projectId,
            partyId: row.partyId,
            purchaseOrderId: row.purchaseOrderId ?? "",
            date: day(row.date),
            vendorInvoiceNo: row.vendorInvoiceNo,
            vendorInvoiceDate: day(row.vendorInvoiceDate),
            dueDate: day(row.dueDate),
            notes: row.notes ?? "",
          }}
          initialLines={initialLines}
        />
      </FormCard>
    </div>
  );
}
