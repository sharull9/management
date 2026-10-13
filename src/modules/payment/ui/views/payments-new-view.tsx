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
      description="Choose the document currency; the exchange rate is prefilled for the date and can be overridden."
      cardTitle="Details"
    >
      <PaymentForm org={org} data={formData(d)} initialRequestId={requestId} />
    </MasterFormPage>
  );
}
