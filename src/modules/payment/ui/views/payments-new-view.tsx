import { MasterFormPage } from "@/modules/masters/ui/components/master-pages";
import { financeData } from "../../server/queries";
import { PaymentForm } from "../components/payment-form";
import { formData } from "../util";

export async function PaymentsNew({
  org,
  requestId,
}: {
  org: string;
  requestId?: string;
}) {
  const d = await financeData(org, "payment.record");
  return (
    <MasterFormPage
      backHref={`/${org}/finance/payments`}
      backLabel="All payments"
      title="Record payment"
      description="Amounts use the project currency or organization currency when no project is selected."
      cardTitle="Details"
    >
      <PaymentForm org={org} data={formData(d)} initialRequestId={requestId} />
    </MasterFormPage>
  );
}
