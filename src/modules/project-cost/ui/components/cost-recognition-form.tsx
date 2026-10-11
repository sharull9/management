"use client";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { MaterialCostRecognitionField } from "@/components/shared/form/material-cost-recognition-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { costRecognitionInput } from "../../schema";
import { saveProjectCostRecognitionAction } from "../../server/actions";
export function CostRecognitionForm({
  org,
  projectId,
  mode,
}: {
  org: string;
  projectId: string;
  mode: "ON_RECEIPT" | "ON_CONSUMPTION";
}) {
  const form = useZodForm(costRecognitionInput, {
    materialCostRecognition: mode,
    confirmCostRecognitionChange: false,
  });
  return (
    <ActionFormShell
      form={form}
      action={saveProjectCostRecognitionAction.bind(null, org, projectId)}
      submit="Save material cost setting"
    >
      <MaterialCostRecognitionField
        control={form.control}
        name="materialCostRecognition"
        existingProject
        confirmationName="confirmCostRecognitionChange"
      />
    </ActionFormShell>
  );
}
