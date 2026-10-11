import { masterData } from "../../server/queries";
import { LevelsTable } from "../components/levels-table";
import { MasterListPage } from "../components/master-pages";

export async function LevelsView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <MasterListPage
      title="Item levels"
      description="Shared across organizations in this tenant. Up to five levels."
      newHref={`/${org}/masters/levels/new`}
      newLabel="New level"
    >
      <LevelsTable
        org={org}
        levels={data.levels.map((l) => ({
          id: l.id,
          level: l.level,
          name: l.name,
          values: l.values.length,
          enabled: l.enabled,
        }))}
      />
    </MasterListPage>
  );
}
