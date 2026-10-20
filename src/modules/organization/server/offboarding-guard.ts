import { UserFacingError } from "@/core/errors";
export function assertNoApprovalAssignments(
  activePolicyAssignments: number,
  pendingApprovalAssignments: number,
) {
  if (activePolicyAssignments || pendingApprovalAssignments)
    throw new UserFacingError(
      "Remove this member from active approval policies and pending approval requests before removing organization access.",
    );
}
