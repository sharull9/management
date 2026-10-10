"use client";
import { WorkspaceErrorView } from "@/modules/organization/ui/views/workspace-error-view";
export default function Page(props: Parameters<typeof WorkspaceErrorView>[0]) {
  return <WorkspaceErrorView {...props} />;
}
