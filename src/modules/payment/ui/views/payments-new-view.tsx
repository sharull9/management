import { MasterFormPage } from "@/modules/masters/ui/components/master-pages";
import { paymentFormData } from "../../server/form-queries";
import { PaymentForm } from "../components/payment-form";

export async function PaymentsNew({
  org,
  requestId,
  projectId,
}: {
  org: string;
  requestId?: string;
  projectId?: string;
}) {
  const data = await paymentFormData(org, requestId, projectId);
  return (
    <MasterFormPage
      backHref={`/${org}/finance/payments`}
      backLabel="All payments"
      title="Record payment"
      description="Choose the document currency; the exchange rate is prefilled for the date and can be overridden."
      cardTitle="Details"
    >
      <PaymentForm
        org={org}
        data={data}
        initialRequestId={requestId}
        initialProjectId={projectId}
      />
    </MasterFormPage>
  );
}
