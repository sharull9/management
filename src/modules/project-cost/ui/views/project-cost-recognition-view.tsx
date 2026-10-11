import type { Project } from "@/generated/prisma/client";
import { CostRecognitionForm } from "../components/cost-recognition-form";
export function ProjectCostRecognitionForm({
  org,
  project,
}: {
  org: string;
  project: Project;
}) {
  return (
    <CostRecognitionForm
      org={org}
      projectId={project.id}
      mode={project.materialCostRecognition}
    />
  );
}
