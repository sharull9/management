import { masterData } from "../../server/queries";
import { MasterListPage } from "../components/master-pages";
import { UomGroupsTable } from "../components/uom-groups-table";

export async function UomsView({ org }: { org: string }) {
  const data = await masterData(org);
  return (
    <MasterListPage
      title="UOM groups"
      description="Units and conversions, shared across organizations in this tenant."
      newHref={`/${org}/masters/uoms/new`}
      newLabel="New UOM group"
    >
      <UomGroupsTable
        org={org}
        groups={data.groups.map((g) => {
          const units = data.uoms.filter((u) => u.groupId === g.id);
          const base = units.find((u) => u.isBase);
          return {
            id: g.id,
            name: g.name ?? "",
            baseUnit: base ? `${base.code} · ${base.name}` : "",
            units: units.length,
            system: !g.tenantId,
          };
        })}
      />
    </MasterListPage>
  );
}
