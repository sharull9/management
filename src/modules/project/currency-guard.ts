/**
 * Cost entries, budgets and totals of a project are kept in its currency, so
 * the currency is frozen once anything has been posted against the project.
 * Returns the message to show when the change is not allowed.
 */
export function projectCurrencyChangeError(input: {
  current: string;
  next: string;
  costEntries: number;
}): string | null {
  if (input.current === input.next || input.costEntries === 0) return null;
  const entries =
    input.costEntries === 1
      ? "1 cost entry"
      : `${input.costEntries} cost entries`;
  return `The project currency cannot change from ${input.current} to ${input.next} because the project already has ${entries}; their amounts would be mixed across currencies.`;
}
