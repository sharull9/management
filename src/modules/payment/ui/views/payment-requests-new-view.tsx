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
      description="Amounts use the project currency or organization currency when no project is selected."
    >
      <RequestForm org={org} data={formData(d)} />
    </RequestFormPage>
  );
}
