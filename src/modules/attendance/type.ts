import type { PayTerms } from "./server/costing";
export type AttendanceRow = {
  workerId: string;
  name: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE";
  hoursWorked: string;
  overtimeHours: string;
  terms: PayTerms;
  remove?: boolean;
};
