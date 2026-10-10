import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission } from "@/core/context";

import { salesData } from "../../server/queries";
import { InvoiceForm } from "../components/invoice-form";

import { formData } from "../util";
export async function InvoiceNew({
  org,
  projectId,
}: {
  org: string;
  projectId?: string;
}) {
  const d = await salesData(org, projectId, "sales.invoice.create");
  if (!projectId && !d.projects.length)
    assertPermission(d.ctx, "sales.invoice.create");
  return (
    <>
      <PageHeading
        title="New sales invoice"
        description="Customer billing for goods and services."
      />
      <FormCard title="Draft invoice">
        <InvoiceForm org={org} data={formData(d)} initial={{ projectId }} />
      </FormCard>
    </>
  );
}
