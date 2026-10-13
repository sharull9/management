import { EmptyState } from "@/components/shared/empty-state";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { listExchangeRates } from "../../server/queries";

// Placeholder: the exchange-rate management UI is built in Phase 3c wave 2.
export async function ExchangeRatesView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "exchangeRate.manage");
  const rates = await listExchangeRates(ctx.org.id);
  return (
    <>
      <PageHeading
        title="Exchange rates"
        description={`Base currency units per 1 unit of the foreign currency, for ${ctx.org.name} (${ctx.org.baseCurrency}).`}
      />
      {!rates.length && <EmptyState title="No exchange rates yet." />}
      <ul className="divide-y rounded-md border text-sm">
        {rates.map((rate) => (
          <li key={rate.id} className="flex gap-3 px-3 py-2">
            <span className="w-24">
              {rate.rateDate.toISOString().slice(0, 10)}
            </span>
            <span className="w-12 font-medium">{rate.currencyCode}</span>
            <span className="tabular-nums">{rate.rate}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
