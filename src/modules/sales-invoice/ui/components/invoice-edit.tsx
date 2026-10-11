import { FormCard } from "@/components/shared/form-card";
import { assertPermission, requireProjectContext } from "@/core/context";

import { invoiceDetail, salesData } from "../../server/queries";
import { formData } from "../util";
import { InvoiceForm } from "./invoice-form";
export async function InvoiceEdit({
  org,
  invoiceId,
}: {
  org: string;
  invoiceId: string;
}) {
  const { row: r } = await invoiceDetail(org, invoiceId);
  if (r.projectId)
    assertPermission(
      await requireProjectContext(org, r.projectId),
      "sales.invoice.create",
    );
  const d = await salesData(org, undefined, "sales.invoice.create", {
    customerIds: [r.partyId],
    itemIds: r.lines.flatMap((line) =>
      line.variant ? [line.variant.itemId] : [],
    ),
    groupIds: r.lines.flatMap((line) =>
      line.taxGroupId ? [line.taxGroupId] : [],
    ),
  });
  return (
    <FormCard title="Edit draft">
      <InvoiceForm
        org={org}
        data={formData(d, r.projectId)}
        initial={{
          id: r.id,
          projectId: r.projectId,
          partyId: r.partyId,
          date: r.date.toISOString().slice(0, 10),
          dueDate: r.dueDate?.toISOString().slice(0, 10),
          stateId: r.stateId,
          notes: r.notes ?? "",
          lines: r.lines.map((l) => ({
            itemId: l.variant?.itemId ?? null,
            levels: l.variant
              ? [
                  l.variant.level1Id,
                  l.variant.level2Id,
                  l.variant.level3Id,
                  l.variant.level4Id,
                  l.variant.level5Id,
                ]
              : [],
            description: l.description,
            qty: l.qty.toString(),
            uomId: l.uomId,
            rate: l.rate.toString(),
            discountPercent: l.discountPercent.toString(),
            taxGroupId: l.taxGroupId,
            fromProjectStock: l.fromProjectStock,
          })),
        }}
      />
    </FormCard>
  );
}
