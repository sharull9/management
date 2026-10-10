import { Decimal, type Numeric } from "@/core/decimal";

export function assertReceiptQuantity(
  ordered: Numeric,
  received: Numeric,
  incoming: Numeric,
  tolerance: Numeric = "0",
) {
  const quantities = [ordered, received, incoming, tolerance].map(
    (q) => new Decimal(q),
  );
  if (quantities.some((q) => !q.isFinite() || q.lt(0)) || quantities[3].gt(100))
    throw new Error("Invalid receipt quantity or tolerance.");
  if (
    quantities[1]
      .add(quantities[2])
      .gt(quantities[0].mul(new Decimal(1).add(quantities[3].div(100))))
  )
    throw new Error(
      "Received quantity exceeds the ordered quantity and tolerance.",
    );
}
