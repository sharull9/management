"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Combobox, type Option } from "@/components/shared/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
export function FinanceFilters({
  fields,
}: {
  fields: {
    name: string;
    label: string;
    value: string | null;
    options: Option[];
    placeholder?: string;
    clearable?: boolean;
    loadOptions?: (query: string) => Promise<Option[]>;
  }[];
}) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  return (
    <form
      className="flex max-w-xl flex-wrap gap-3"
      onSubmit={(e) => e.preventDefault()}
    >
      {fields.map((field) => (
        <Field key={field.name} className="min-w-44 flex-1">
          <FieldLabel htmlFor={`filter-${field.name}`}>
            {field.label}
          </FieldLabel>
          <Combobox
            id={`filter-${field.name}`}
            options={field.options}
            value={field.value}
            clearable={field.clearable}
            placeholder={field.placeholder}
            loadOptions={field.loadOptions}
            onChange={(value) => {
              const next = new URLSearchParams(params.toString());
              if (value) next.set(field.name, value);
              else next.delete(field.name);
              router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
                scroll: false,
              });
            }}
          />
        </Field>
      ))}
    </form>
  );
}
