const state = globalThis as typeof globalThis & {
  __reminderWorkerTestPoll?: () => Promise<number>;
};

export async function dispatchApprovalReminders() {
  return state.__reminderWorkerTestPoll?.() ?? 0;
}
