export type StatusTone =
  | "neutral"
  | "blue"
  | "purple"
  | "green"
  | "amber"
  | "red"
  | "teal";

const tones: Record<string, StatusTone> = {
  ACTIVE: "green",
  APPROVED: "green",
  COMPLETED: "green",
  PAID: "green",
  POSTED: "green",
  RECEIVED: "green",
  PRESENT: "green",
  PENDING: "amber",
  PENDING_APPROVAL: "amber",
  SUBMITTED: "amber",
  WAITING: "amber",
  HALF_DAY: "amber",
  REWORK: "amber",
  ON_HOLD: "amber",
  IN_PROGRESS: "blue",
  PARTIALLY_PAID: "blue",
  PARTIALLY_RECEIVED: "blue",
  PLANNED: "purple",
  TODO: "purple",
  OVERDUE: "red",
  REJECTED: "red",
  SUSPENDED: "red",
  ABSENT: "red",
  VOID: "red",
  CLOSED: "teal",
  LEAVE: "teal",
};

/** Maps a status enum value or label to a colour tone. Unknown values stay neutral. */
export function statusTone(status: string): StatusTone {
  return tones[status.trim().toUpperCase().replaceAll(" ", "_")] ?? "neutral";
}

/** Turns `PENDING_APPROVAL` into `Pending approval`. */
export function statusLabel(status: string) {
  const text = status.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
