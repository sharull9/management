import { Decimal, money, type Numeric } from "@/core/decimal";
export type MaterialCostMode = "ON_RECEIPT" | "ON_CONSUMPTION";
export function materialCostEffects(input: {
  event: "GRN" | "CONSUMPTION" | "TRANSFER";
  sourceMode: MaterialCostMode;
  destMode?: MaterialCostMode;
  value: Numeric;
}): { projectSide: "source" | "destination"; amount: string }[] {
  const rawValue = new Decimal(input.value);
  if (!rawValue.isFinite() || rawValue.lt(0))
    throw new Error("Invalid material value.");
  const value = money(rawValue);
  if (input.event === "TRANSFER") {
    if (!input.destMode)
      throw new Error("Destination recognition mode is required.");
    return [
      ...(input.sourceMode === "ON_RECEIPT"
        ? [{ projectSide: "source" as const, amount: value.neg().toFixed(2) }]
        : []),
      ...(input.destMode === "ON_RECEIPT"
        ? [{ projectSide: "destination" as const, amount: value.toFixed(2) }]
        : []),
    ];
  }
  const recognize =
    input.event === "GRN"
      ? input.sourceMode === "ON_RECEIPT"
      : input.sourceMode === "ON_CONSUMPTION";
  return recognize ? [{ projectSide: "source", amount: value.toFixed(2) }] : [];
}

export function assertCostRecognitionChange(input: {
  oldMode: MaterialCostMode;
  newMode: MaterialCostMode;
  hasStockMovements: boolean;
  confirmed: boolean;
}) {
  if (
    input.oldMode !== input.newMode &&
    input.hasStockMovements &&
    !input.confirmed
  )
    throw new Error(
      "Confirm that this change applies only to future transactions; past cost entries are not restated.",
    );
}
