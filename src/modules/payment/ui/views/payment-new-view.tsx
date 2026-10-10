import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { financeData } from "../../server/queries";
import { PaymentForm } from "../components/payment-form";
import { RequestForm } from "../components/request-form";

import { formData } from "../util";
export async function FinanceNew({
  org,
  kind,
  requestId,
}: {
  org: string;
  kind: "payments" | "payment-requests";
  requestId?: string;
}) {
  const d = await financeData(
    org,
    kind === "payments" ? "payment.record" : "payment.request.create",
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title={kind === "payments" ? "Record payment" : "New payment request"}
        description="Amounts use the project currency or organization currency when no project is selected."
      />
      <FormCard title="Details">
        {kind === "payments" ? (
          <PaymentForm
            org={org}
            data={formData(d)}
            initialRequestId={requestId}
          />
        ) : (
          <RequestForm org={org} data={formData(d)} />
        )}
      </FormCard>
    </div>
  );
}
