import { UserFacingError } from "@/core/errors";
export type StepRule = {
  sequence: number;
  name: string;
  approverType: "ROLE" | "USER" | "PROJECT_MANAGER" | "STAGE_MANAGER";
  roleId?: string | null;
  userId?: string | null;
  minAmount?: { toString(): string } | string | null;
};
export function moneyCents(value: string): bigint {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new UserFacingError(
      "Amount must be a non-negative decimal with at most two places.",
    );
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function filterSteps<T extends StepRule>(
  steps: T[],
  amount?: string | null,
): T[] {
  const cents = moneyCents(amount ?? "0");
  return steps
    .filter(
      (step) =>
        step.minAmount == null ||
        cents >= moneyCents(step.minAmount.toString()),
    )
    .sort((a, b) => a.sequence - b.sequence);
}
export function snapshotSteps(steps: StepRule[], amount?: string | null) {
  const applicable = filterSteps(steps, amount);
  const rules: StepRule[] = applicable.length
    ? applicable
    : [{ sequence: 1, name: "Approval", approverType: "PROJECT_MANAGER" }];
  return rules.map((step, index) => ({
    name: step.name,
    sequence: index + 1,
    approverType: step.approverType,
    roleId: step.roleId ?? null,
    userId: step.userId ?? null,
    minAmount: step.minAmount?.toString() ?? null,
    status: index === 0 ? ("PENDING" as const) : ("WAITING" as const),
  }));
}
export function nextStep<T extends { sequence: number; status: string }>(
  steps: T[],
  current: number,
) {
  return (
    steps
      .filter((step) => step.sequence > current && step.status === "WAITING")
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}
