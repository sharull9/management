export type CurrencyRow = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  active: boolean;
};
export type TenantCurrencyRow = CurrencyRow & { enabled: boolean };
export type ExchangeRateRow = {
  id: string;
  currencyCode: string;
  rateDate: Date;
  rate: string;
  createdByName?: string;
};
