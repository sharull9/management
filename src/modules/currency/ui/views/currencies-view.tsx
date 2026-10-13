import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { listCurrencySettings } from "../../server/queries";
import { AddCurrencyForm } from "../components/add-currency-form";
import { CurrenciesTable } from "../components/currencies-table";

export async function CurrenciesView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  const canManage = ctx.isAdmin || ctx.permissions.has("currency.manage");
  if (!canManage) assertPermission(ctx, "settings.manage");
  const { tenant, available } = await listCurrencySettings(ctx.tenant.id);
  const base = ctx.org.baseCurrency;
  return (
    <>
      <PageHeading
        title="Currencies"
        description={`Currencies ${ctx.tenant.name} can use on documents. ${ctx.org.name} reports in ${base}, which is always enabled.`}
      />
      <CurrenciesTable
        org={org}
        canManage={canManage}
        currencies={tenant.map((currency) => ({
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          decimals: currency.decimals,
          enabled: currency.enabled,
          isBase: currency.code === base,
        }))}
      />
      {canManage && (
        <FormCard
          title="Add a currency"
          description="Choose from the global currency list. A currency in use by a project or party default cannot be disabled."
        >
          <AddCurrencyForm
            org={org}
            available={available.map(({ code, name, symbol }) => ({
              code,
              name,
              symbol,
            }))}
          />
        </FormCard>
      )}
    </>
  );
}
