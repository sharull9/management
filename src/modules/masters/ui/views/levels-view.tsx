import { PageHeading } from "@/components/shared/page-heading";
import { masterData } from "../../server/queries";
import { LevelMasters } from "../components/master-forms";

export async function LevelsView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Item levels"
        description="Shared across organizations in this tenant."
      />
      <LevelMasters org={org} data={data} />
    </>
  );
}
