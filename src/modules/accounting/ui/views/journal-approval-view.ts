export function journalApprovalView(request: {
  id: string;
  status: string;
  createdAt: Date;
  steps: Array<{
    id: string;
    sequence: number;
    name: string;
    status: string;
    actedBy: { id: string; name: string } | null;
    comment: string | null;
  }>;
}) {
  return [
    {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      steps: request.steps.map((step) => ({ ...step })),
    },
  ];
}
