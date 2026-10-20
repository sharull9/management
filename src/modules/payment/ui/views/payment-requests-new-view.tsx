import { requestFormData } from "../../server/form-queries";
import { RequestForm } from "../components/request-form";
import { RequestFormPage } from "../components/request-form-page";

export async function FinanceNew({
  org,
  projectId,
}: {
  org: string;
  kind?: string;
  projectId?: string;
}) {
  const { data } = await requestFormData(org, undefined, projectId);
  return (
    <RequestFormPage
      backHref={`/${org}/finance/payment-requests`}
      backLabel="All payment requests"
      title="New payment request"
      description="Choose the document currency; the exchange rate is prefilled for the date and can be overridden."
    >
      <RequestForm org={org} data={data} initialProjectId={projectId} />
    </RequestFormPage>
  );
}
