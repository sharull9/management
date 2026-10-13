import { financeData } from "../../server/queries";
import { RequestForm } from "../components/request-form";
import { RequestFormPage } from "../components/request-form-page";
import { formData } from "../util";

export async function FinanceNew({ org }: { org: string; kind?: string }) {
  const d = await financeData(org, "payment.request.create");
  return (
    <RequestFormPage
      backHref={`/${org}/finance/payment-requests`}
      backLabel="All payment requests"
      title="New payment request"
      description="Choose the document currency; the exchange rate is prefilled for the date and can be overridden."
    >
      <RequestForm org={org} data={formData(d)} />
    </RequestFormPage>
  );
}
