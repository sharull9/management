"use client";

import { Search, X } from "lucide-react";
import { debounce, parseAsString, useQueryStates } from "nuqs";
import {
  createContext,
  type ReactNode,
  type TransitionStartFunction,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Combobox, type Option } from "../combobox/combobox";
import { DatePicker } from "../date-picker/date-picker";
import { parseMultiParam, serializeMultiParam } from "./multi-param";

type FilterBarContext = {
  register: (name: string) => () => void;
  startTransition: TransitionStartFunction;
};
const FilterBarContext = createContext<FilterBarContext | null>(null);

/** Filters re-render the server view, so URL updates are non-shallow. */
function filterOptions(startTransition?: TransitionStartFunction) {
  return {
    shallow: false,
    scroll: false,
    history: "replace" as const,
    startTransition,
  };
}

function useUrlFilter(name: string, debounceMs?: number) {
  const bar = useContext(FilterBarContext);
  useEffect(() => bar?.register(name), [bar, name]);
  const [values, setValues] = useQueryStates(
    { [name]: parseAsString, page: parseAsString },
    {
      ...filterOptions(bar?.startTransition),
      ...(debounceMs ? { limitUrlUpdates: debounce(debounceMs) } : {}),
    },
  );
  return [
    values[name],
    (value: string | null) => setValues({ [name]: value, page: null }),
  ] as const;
}

/**
 * A compact, auto-applying filter toolbar. Each control owns one URL search
 * param (via nuqs); the server view reads `searchParams` and re-renders.
 */
export function FilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [names, setNames] = useState<string[]>([]);
  const context = useMemo<FilterBarContext>(
    () => ({
      startTransition,
      register: (name) => {
        setNames((current) =>
          current.includes(name) ? current : [...current, name],
        );
        return () =>
          setNames((current) => current.filter((item) => item !== name));
      },
    }),
    [],
  );
  const [values, setValues] = useQueryStates(
    Object.fromEntries([...names, "page"].map((name) => [name, parseAsString])),
    filterOptions(startTransition),
  );
  const active = names.some((name) => values[name] !== null);
  return (
    <FilterBarContext value={context}>
      <search
        aria-label="Filters"
        aria-busy={pending}
        className={cn("flex flex-wrap items-center gap-2", className)}
      >
        {children}
        {pending && <Spinner className="text-muted-foreground" />}
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setValues(
                Object.fromEntries(
                  [...names, "page"].map((name) => [name, null]),
                ),
              )
            }
          >
            <X data-icon="inline-start" />
            Reset
          </Button>
        )}
      </search>
    </FilterBarContext>
  );
}

export function FilterSearch({
  name = "search",
  placeholder = "Search…",
  className,
}: {
  name?: string;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useUrlFilter(name, 300);
  return (
    <InputGroup className={cn("w-full sm:w-64", className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value ?? ""}
        maxLength={150}
        onChange={(event) => setValue(event.target.value || null)}
      />
    </InputGroup>
  );
}

export function FilterSelect({
  name,
  label,
  options,
  loadOptions,
  clearable = true,
  fallback,
  className,
}: {
  name: string;
  label: string;
  options: Option[];
  loadOptions?: (query: string) => Promise<Option[]>;
  clearable?: boolean;
  /** Value the server applies when the param is absent, shown as selected. */
  fallback?: string;
  className?: string;
}) {
  const [param, setValue] = useUrlFilter(name);
  const value = param ?? fallback ?? null;
  return (
    <Combobox
      aria-label={label}
      triggerLabel={label}
      options={options}
      loadOptions={loadOptions}
      value={value}
      onChange={setValue}
      clearable={clearable}
      className={cn(
        "w-auto max-w-64 min-w-36",
        !value && "border-dashed",
        className,
      )}
    />
  );
}

/**
 * Multi-select filter. Stores selected values in the URL param `name` as a
 * comma-separated list (`?status=ACTIVE,PLANNED`). Props: `name`, `label`,
 * `options` (Option[], may carry `tone`/`icon`), optional `loadOptions`,
 * `queryKey`, `className`. Shows checkboxes, a "Clear filters" row, and the
 * trigger reads "Label: <badge>" or "Label: N selected". On the server read it
 * with `parseMultiParam(searchParams.name)` from `./multi-param`.
 */
export function FilterMultiSelect({
  name,
  label,
  options,
  loadOptions,
  queryKey,
  className,
}: {
  name: string;
  label: string;
  options: Option[];
  loadOptions?: (query: string) => Promise<Option[]>;
  queryKey?: readonly unknown[];
  className?: string;
}) {
  const [param, setParam] = useUrlFilter(name);
  const value = useMemo(() => parseMultiParam(param), [param]);
  return (
    <Combobox
      multiple
      checkboxes
      summarize
      aria-label={label}
      triggerLabel={label}
      options={options}
      loadOptions={loadOptions}
      queryKey={queryKey ?? ["filter", name]}
      value={value}
      onChange={(next) => setParam(serializeMultiParam(next))}
      clearLabel="Clear filters"
      className={cn(
        "w-auto max-w-64 min-w-36",
        !value.length && "border-dashed",
        className,
      )}
    />
  );
}

export function FilterDate({
  name,
  label,
  clearable = true,
  min,
  max,
}: {
  name: string;
  label: string;
  clearable?: boolean;
  min?: string;
  max?: string;
}) {
  const [value, setValue] = useUrlFilter(name);
  return (
    <DatePicker
      aria-label={label}
      value={value ?? ""}
      onChange={(next) => setValue(next || null)}
      placeholder={label}
      clearable={clearable}
      min={min}
      max={max}
      className={cn("w-auto min-w-36", !value && "border-dashed")}
    />
  );
}

export function FilterToggle({ name, label }: { name: string; label: string }) {
  const [value, setValue] = useUrlFilter(name);
  const id = `filter-${name}`;
  return (
    <div className="flex h-8 items-center gap-2 rounded-lg border border-dashed px-2.5 has-data-[state=checked]:border-solid">
      <Checkbox
        id={id}
        checked={value === "1"}
        onCheckedChange={(checked) => setValue(checked === true ? "1" : null)}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
