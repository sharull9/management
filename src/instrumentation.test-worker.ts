const state = globalThis as typeof globalThis & {
  __instrumentationReminderStarts?: number;
};

export function startApprovalReminderWorker() {
  state.__instrumentationReminderStarts =
    (state.__instrumentationReminderStarts ?? 0) + 1;
}
