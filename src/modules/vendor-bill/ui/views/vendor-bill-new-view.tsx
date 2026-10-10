import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { billOptions } from "../../server/queries";
import { BillForm } from "../components/vendor-bill-form";

const _day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
export async function NewBill({ org, po }: { org: string; po?: string }) {
  const data = await billOptions(org);
  if (po && !data.orders.some((o) => o.id === po))
    throw new Error(
      "Purchase order is unavailable or you lack bill creation access to its project.",
    );
  return (
    <>
      <PageHeading
        title="Create vendor bill"
        description="Save a draft, attach the vendor invoice, then submit for approval."
      />
      <FormCard title="Bill details">
        {data.projects.length ? (
          <BillForm org={org} data={data} initial={{ purchaseOrderId: po }} />
        ) : (
          <p>No projects available for bill creation.</p>
        )}
      </FormCard>
    </>
  );
}
