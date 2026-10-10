import type { Project } from "@/generated/prisma/client";
import { SelectField } from "./fields";
export function MaterialCostRecognitionFields({
  mode = "ON_CONSUMPTION",
  existingProject = false,
}: {
  mode?: Project["materialCostRecognition"];
  existingProject?: boolean;
}) {
  return (
    <div className="space-y-3">
      <SelectField
        label="Material cost recognition"
        name="materialCostRecognition"
        defaultValue={mode}
      >
        <option value="ON_CONSUMPTION">On consumption</option>
        <option value="ON_RECEIPT">On receipt</option>
      </SelectField>
      <p className="text-sm text-muted-foreground">
        On receipt recognizes accepted GRNs and adjusts costs on transfers. On
        consumption recognizes materials when used.
      </p>
      {existingProject && (
        <>
          <p className="text-sm text-amber-700">
            Changes apply only to future transactions. Past cost entries are not
            restated. Projects with any stock movement history require
            confirmation, even if stock on hand is zero.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirmCostRecognitionChange" />I
            confirm this change applies only to future transactions and past
            cost entries will not be restated.
          </label>
        </>
      )}
    </div>
  );
}
