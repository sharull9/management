export type TimelineRequest = {
  id: string;
  status: string;
  createdAt: Date;
  steps: {
    id: string;
    sequence: number;
    name: string;
    status: string;
    actedBy: { name: string } | null;
    comment: string | null;
  }[];
};
export type TimelineProps = {
  org: string;
  approvals: TimelineRequest[];
  variant: "procurement" | "bill" | "payment" | "sales";
};
