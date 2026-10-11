const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function timeAgo(date: Date, now: number) {
  const diff = date.getTime() - now;
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === "minute") {
      if (unit === "day" && Math.abs(diff) > 7 * ms)
        return date.toLocaleDateString("en-IN", { dateStyle: "medium" });
      return relative.format(Math.round(diff / ms), unit);
    }
  }
  return "";
}

function describe(entry: ActivityEntry) {
  const subject = entry.subject ? ` ${entry.subject}` : "";
  if (entry.entityType === "Tenant") {
    if (entry.action === "CREATE") return `created tenant${subject}`;
    if (entry.action === "SUSPENDED") return `suspended${subject}`;
    if (entry.action === "ACTIVE") return `reactivated${subject}`;
  }
  if (entry.entityType === "User" && entry.action === "SETUP")
    return "set up the platform";
  const verb =
    entry.action === "CREATE"
      ? "created"
      : entry.action === "UPDATE"
        ? "updated"
        : entry.action.toLowerCase();
  return `${verb} ${entry.entityType.toLowerCase()}${
    entry.entityType === "User" ? "" : ` in${subject}`
  }`.trim();
}

export type ActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  actor: string;
  subject?: string;
  createdAt: Date;
};

export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  const now = Date.now();
  return (
    <ol className="divide-y">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0"
        >
          <p className="min-w-0">
            <span className="font-medium">{entry.actor}</span>{" "}
            <span className="text-muted-foreground">{describe(entry)}</span>
          </p>
          <time
            dateTime={entry.createdAt.toISOString()}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {timeAgo(entry.createdAt, now)}
          </time>
        </li>
      ))}
    </ol>
  );
}
