import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/shared/page-heading";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
import { Decimal } from "@/core/decimal";
import { masterData } from "../../server/queries";
import { TaxComponentsTable, TaxGroupsTable } from "../components/tax-tables";

export async function TaxView({ org }: { org: string }) {
  const data = await masterData(org);
  const components = new Map(data.components.map((c) => [c.id, c]));
  const countries = new Map(data.countries.map((c) => [c.id, c.name]));
  const base = `/${org}/masters/tax`;
  return (
    <>
      <PageHeading
        title="Tax"
        description="Shared across organizations in this tenant."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`${base}/components/new`}>
                <Plus data-icon="inline-start" />
                New component
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/groups/new`}>
                <Plus data-icon="inline-start" />
                New group
              </Link>
            </Button>
          </>
        }
      />
      <UrlTabs
        tabs={[
          {
            value: "groups",
            label: "Tax groups",
            count: data.taxGroups.length,
            content: (
              <TaxGroupsTable
                org={org}
                groups={data.taxGroups.map((g) => {
                  const parts = g.components.flatMap((x) => {
                    const c = components.get(x.componentId);
                    return c ? [c] : [];
                  });
                  return {
                    id: g.id,
                    name: g.name,
                    country: (g.countryId && countries.get(g.countryId)) || "",
                    scope: g.scope,
                    components: parts.map((c) => c.name).join(", "),
                    totalRate: parts
                      .filter((c) => !c.isWithholding)
                      .reduce((a, c) => a.add(c.rate), new Decimal(0))
                      .toString(),
                  };
                })}
              />
            ),
          },
          {
            value: "components",
            label: "Tax components",
            count: data.components.length,
            content: (
              <TaxComponentsTable
                org={org}
                components={data.components.map((c) => ({
                  id: c.id,
                  name: c.name,
                  code: c.code,
                  rate: c.rate,
                  appliesTo: c.appliesTo,
                  isWithholding: c.isWithholding,
                }))}
              />
            ),
          },
        ]}
      />
    </>
  );
}
