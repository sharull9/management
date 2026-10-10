import { ActionForm } from "@/components/shared/action-form";
import { MaterialCostRecognitionFields } from "@/components/shared/material-cost-recognition-fields";
import type { Project } from "@/generated/prisma/client";
import { saveProjectCostRecognitionAction } from "../../server/actions";
export function ProjectCostRecognitionForm({
  org,
  project,
}: {
  org: string;
  project: Project;
}) {
  return (
    <ActionForm
      action={saveProjectCostRecognitionAction.bind(null, org, project.id)}
      submit="Save material cost setting"
    >
      <MaterialCostRecognitionFields
        mode={project.materialCostRecognition}
        existingProject
      />
    </ActionForm>
  );
}
