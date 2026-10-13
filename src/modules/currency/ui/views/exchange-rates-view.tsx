import { EmptyState } from "@/components/shared/empty-state";
import { dateValue } from "@/components/shared/form/date-value";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import {
  latestExchangeRates,
  listEnabledCurrencies,
  listExchangeRates,
} from "../../server/queries";
import { ExchangeRateFilters } from "../components/exchange-rate-filters";
import { ExchangeRatesTable } from "../components/exchange-rates-table";
import { LatestRates } from "../components/latest-rates";
import { NewExchangeRateSheet } from "../components/new-exchange-rate-sheet";

const dateParam = /^\d{4}-\d{2}-\d{2}$/;

export async function ExchangeRatesView({
  org,
  searchParams,
}: {
  org: string;
  searchParams: { currency?: string; from?: string; to?: string };
}) {
  const ctx = await requireOrgContext(org);
  const canManage = ctx.isAdmin || ctx.permissions.has("exchangeRate.manage");
  if (!canManage) assertPermission(ctx, "settings.manage");
  const base = ctx.org.baseCurrency;
  const { currency, from, to } = searchParams;
  const [enabled, rates, latest] = await Promise.all([
    listEnabledCurrencies(ctx.tenant.id, base),
    listExchangeRates(ctx.org.id, {
      currencyCode:
        currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined,
      from: from && dateParam.test(from) ? from : undefined,
      to: to && dateParam.test(to) ? to : undefined,
    }),
    latestExchangeRates(ctx.org.id),
  ]);
  const foreign = enabled
    .filter((row) => row.code !== base)
    .map((row) => ({
      value: row.code,
      label: `${row.code} | ${row.name}`,
      description: row.symbol,
    }));
  return (
    <>
      <PageHeading
        title="Exchange rates"
        description={`Base currency units (${base}) per 1 unit of a foreign currency, for ${ctx.org.name}. Documents use the latest rate on or before their date.`}
        actions={
          canManage && foreign.length > 0 ? (
            <NewExchangeRateSheet
              org={org}
              baseCurrency={base}
              currencies={foreign}
            />
          ) : undefined
        }
      />
      {foreign.length === 0 ? (
        <EmptyState
          title="No foreign currencies enabled."
          description={`Enable a currency other than ${base} in Settings → Currencies to record exchange rates.`}
        />
      ) : (
        <>
          <LatestRates
            baseCurrency={base}
            rates={latest.map((rate) => ({
              currencyCode: rate.currencyCode,
              rateDate: dateValue(rate.rateDate),
              rate: rate.rate,
            }))}
          />
          <ExchangeRateFilters currencies={foreign} />
          <ExchangeRatesTable
            org={org}
            baseCurrency={base}
            canManage={canManage}
            currencies={foreign}
            rates={rates.map((rate) => ({
              id: rate.id,
              currencyCode: rate.currencyCode,
              rateDate: dateValue(rate.rateDate),
              rate: rate.rate,
              createdByName: rate.createdByName ?? "",
            }))}
          />
        </>
      )}
    </>
  );
}
