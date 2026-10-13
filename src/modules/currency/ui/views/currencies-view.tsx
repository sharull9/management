import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { listTenantCurrencies } from "../../server/queries";

// Placeholder: the currency management UI is built in Phase 3c wave 2.
export async function CurrenciesView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "currency.manage");
  const currencies = (await listTenantCurrencies(ctx.tenant.id)).filter(
    (currency) => currency.enabled,
  );
  return (
    <>
      <PageHeading
        title="Currencies"
        description={`Currencies enabled for ${ctx.tenant.name}. Base currency of ${ctx.org.name}: ${ctx.org.baseCurrency}.`}
      />
      {!currencies.length && <EmptyState title="No currencies enabled." />}
      <ul className="divide-y rounded-md border text-sm">
        {currencies.map((currency) => (
          <li key={currency.code} className="flex gap-3 px-3 py-2">
            <span className="w-12 font-medium">{currency.code}</span>
            <span className="flex-1">{currency.name}</span>
            <span className="text-muted-foreground">{currency.symbol}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
