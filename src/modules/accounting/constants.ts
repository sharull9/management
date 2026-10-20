import type { AccountType } from "@/generated/prisma/client";

export const SYSTEM_ACCOUNTS = [
  { key: "CASH", code: "1000", name: "Cash", type: "ASSET" },
  { key: "BANK", code: "1010", name: "Bank", type: "ASSET" },
  {
    key: "VENDOR_ADVANCES",
    code: "1020",
    name: "Vendor Advances",
    type: "ASSET",
  },
  {
    key: "ACCOUNTS_RECEIVABLE",
    code: "1100",
    name: "Accounts Receivable",
    type: "ASSET",
  },
  { key: "INPUT_TAX", code: "1200", name: "Input Tax", type: "ASSET" },
  {
    key: "WITHHOLDING_RECEIVABLE",
    code: "1210",
    name: "Withholding Receivable",
    type: "ASSET",
  },
  { key: "INVENTORY", code: "1300", name: "Inventory", type: "ASSET" },
  {
    key: "TRANSFER_CLEARING",
    code: "1310",
    name: "Transfer Clearing",
    type: "ASSET",
  },
  {
    key: "ACCOUNTS_PAYABLE",
    code: "2000",
    name: "Accounts Payable",
    type: "LIABILITY",
  },
  {
    key: "GRNI",
    code: "2010",
    name: "Goods Received Not Invoiced",
    type: "LIABILITY",
  },
  {
    key: "CUSTOMER_ADVANCES",
    code: "2020",
    name: "Customer Advances",
    type: "LIABILITY",
  },
  { key: "OUTPUT_TAX", code: "2100", name: "Output Tax", type: "LIABILITY" },
  {
    key: "WITHHOLDING_PAYABLE",
    code: "2110",
    name: "Withholding Payable",
    type: "LIABILITY",
  },
  {
    key: "PAYROLL_PAYABLE",
    code: "2200",
    name: "Payroll Payable",
    type: "LIABILITY",
  },
  {
    key: "EXPENSE_PAYABLE",
    code: "2300",
    name: "Expense Payable",
    type: "LIABILITY",
  },
  {
    key: "COST_CLEARING",
    code: "2400",
    name: "Cost Clearing",
    type: "LIABILITY",
  },
  {
    key: "RETAINED_EARNINGS",
    code: "3000",
    name: "Retained Earnings",
    type: "EQUITY",
  },
  {
    key: "OPENING_BALANCE_EQUITY",
    code: "3010",
    name: "Opening Balance Equity",
    type: "EQUITY",
  },
  { key: "SALES_REVENUE", code: "4000", name: "Sales Revenue", type: "INCOME" },
  {
    key: "FX_GAIN",
    code: "4100",
    name: "Foreign Exchange Gain",
    type: "INCOME",
  },
  {
    key: "LABOUR_EXPENSE",
    code: "5000",
    name: "Labour Expense",
    type: "EXPENSE",
  },
  {
    key: "MATERIAL_EXPENSE",
    code: "5010",
    name: "Material Expense",
    type: "EXPENSE",
  },
  {
    key: "EQUIPMENT_EXPENSE",
    code: "5020",
    name: "Equipment Expense",
    type: "EXPENSE",
  },
  { key: "FUEL_EXPENSE", code: "5030", name: "Fuel Expense", type: "EXPENSE" },
  {
    key: "ELECTRICITY_EXPENSE",
    code: "5040",
    name: "Electricity Expense",
    type: "EXPENSE",
  },
  {
    key: "SUBCONTRACT_EXPENSE",
    code: "5050",
    name: "Subcontract Expense",
    type: "EXPENSE",
  },
  {
    key: "OVERHEAD_EXPENSE",
    code: "5060",
    name: "Overhead Expense",
    type: "EXPENSE",
  },
  {
    key: "OTHER_EXPENSE",
    code: "5070",
    name: "Other Expense",
    type: "EXPENSE",
  },
  {
    key: "COST_OF_GOODS_SOLD",
    code: "5100",
    name: "Cost of Goods Sold",
    type: "EXPENSE",
  },
  {
    key: "PURCHASE_VARIANCE",
    code: "5110",
    name: "Purchase Variance",
    type: "EXPENSE",
  },
  {
    key: "FX_LOSS",
    code: "5120",
    name: "Foreign Exchange Loss",
    type: "EXPENSE",
  },
  { key: "ROUNDING", code: "5130", name: "Rounding", type: "EXPENSE" },
] as const satisfies readonly {
  key: string;
  code: string;
  name: string;
  type: AccountType;
}[];

export type SystemAccountKey = (typeof SYSTEM_ACCOUNTS)[number]["key"];
