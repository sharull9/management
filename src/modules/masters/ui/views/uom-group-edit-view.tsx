import { notFound } from "next/navigation";
import { UrlTabs } from "@/components/shared/url-tabs";
import { masterData } from "../../server/queries";
import { MasterFormPage } from "../components/master-pages";
import { UomGroupForm, UomUnits } from "../components/uom-forms";

export async function UomGroupEditView({
  org,
  groupId,
}: {
  org: string;
  groupId: string;
}) {
  const data = await masterData(org);
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) notFound();
  const count = data.uoms.filter((u) => u.groupId === group.id).length;
  return (
    <MasterFormPage
      backHref={`/${org}/masters/uoms`}
      backLabel="All UOM groups"
      title={group.name ?? ""}
      description={
        group.tenantId ? "Custom group" : "System group (name is read-only)"
      }
      cardTitle="Group details"
      below={
        <UrlTabs
          tabs={[
            {
              value: "units",
              label: "Units",
              count,
              content: <UomUnits org={org} data={data} group={group} />,
            },
          ]}
        />
      }
    >
      {group.tenantId ? (
        <UomGroupForm org={org} group={group} />
      ) : (
        <p className="text-sm text-muted-foreground">
          System groups cannot be renamed or deleted. You can still add units.
        </p>
      )}
    </MasterFormPage>
  );
}
