import { CostType } from "@/generated/prisma/enums";
import { SelectField } from "./fields";
import { EnumOptions } from "./form-options";
export function CostTypeField({
  defaultValue,
}: {
  defaultValue?: string;
} = {}) {
  return (
    <SelectField label="Cost type" name="costType" defaultValue={defaultValue}>
      <EnumOptions values={CostType} />
    </SelectField>
  );
}
