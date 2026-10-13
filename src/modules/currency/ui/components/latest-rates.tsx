import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { describeRate } from "../../rate-format";

export type LatestRate = {
  currencyCode: string;
  rateDate: string;
  rate: string;
};

/** The most recent rate per currency, shown above the history. */
export function LatestRates({
  baseCurrency,
  rates,
}: {
  baseCurrency: string;
  rates: LatestRate[];
}) {
  if (!rates.length) return null;
  return (
    <section aria-label="Latest rates" className="space-y-2">
      <h2 className="text-sm font-medium">Latest rate per currency</h2>
      <ItemGroup className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rates.map((rate) => (
          <Item key={rate.currencyCode} variant="outline" size="sm">
            <ItemContent>
              <ItemTitle className="tabular-nums">
                {describeRate(rate.currencyCode, baseCurrency, rate.rate)}
              </ItemTitle>
              <ItemDescription>As of {rate.rateDate}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </section>
  );
}
