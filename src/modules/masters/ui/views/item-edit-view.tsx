import { notFound } from "next/navigation";
import { UrlTabs } from "@/components/shared/url-tabs";
import { masterData } from "../../server/queries";
import { ItemForm } from "../components/item-form";
import { ItemVariants } from "../components/item-variants";
import { MasterFormPage } from "../components/master-pages";

export async function ItemEditView({
  org,
  itemId,
}: {
  org: string;
  itemId: string;
}) {
  const data = await masterData(org);
  const item = data.items.find((i) => i.id === itemId);
  if (!item) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/items`}
      backLabel="All items"
      title={item.name}
      description={`Code ${item.code}`}
      cardTitle="Item details"
      below={
        <UrlTabs
          tabs={[
            {
              value: "variants",
              label: "Variants",
              count: item.variants.length,
              content: <ItemVariants org={org} data={data} item={item} />,
            },
          ]}
        />
      }
    >
      <ItemForm org={org} data={data} item={item} />
    </MasterFormPage>
  );
}
