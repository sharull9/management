import { MasterFormPage } from "../components/master-pages";
import { TaxComponentForm } from "../components/tax-forms";

export function TaxComponentNewView({ org }: { org: string }) {
  return (
    <MasterFormPage
      backHref={`/${org}/masters/tax?tab=components`}
      backLabel="All tax components"
      title="New tax component"
      description="A single tax or withholding rate, such as CGST or TDS."
      cardTitle="Tax component details"
    >
      <TaxComponentForm org={org} />
    </MasterFormPage>
  );
}
