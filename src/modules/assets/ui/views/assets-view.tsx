import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { requireOrgContext } from "@/core/context";
import type { ListParams } from "@/core/pagination";
import { listAssets } from "../../server/queries";
import { AssetForm } from "../components/asset-form";
import { type AssetRow, AssetsTable } from "../components/assets-table";

export async function AssetsView({
  org,
  projectId,
  params,
}: {
  org: string;
  projectId?: string;
  params?: ListParams;
}) {
  const [{ assets, canManage, page }, ctx] = await Promise.all([
    listAssets(org, projectId, params),
    requireOrgContext(org),
  ]);
  const rows: AssetRow[] = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    code: asset.code,
    type: asset.type,
    meterType: asset.meterType,
    powerType: asset.powerType,
    active: asset.active,
    equipmentRatePerMeter: asset.equipmentRatePerMeter.toString(),
    projectNames: [
      ...new Set(
        asset.allocations.map((allocation) => allocation.project.name),
      ),
    ].join(", "),
  }));
  return (
    <>
      <PageHeading
        title="Assets"
        description="Vehicles and machinery, their project allocations, and operating history."
        actions={
          canManage ? (
            <CreateSheet label="Add asset">
              <AssetForm org={org} baseCurrency={ctx.org.baseCurrency} />
            </CreateSheet>
          ) : undefined
        }
      />
      <AssetsTable
        data={rows}
        org={org}
        projectId={projectId}
        serverPage={page}
      />
    </>
  );
}
