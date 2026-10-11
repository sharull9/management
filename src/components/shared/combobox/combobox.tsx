"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  type AriaAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../status-badge";
import type { StatusTone } from "../status-badge-tone";

export type Option = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Renders the option as the same dot badge tables use (see StatusBadge). */
  tone?: StatusTone;
  /** Leading icon, used when no `tone` is set. */
  icon?: ReactNode;
};

function OptionVisual({ option }: { option: Option }) {
  if (option.tone)
    return (
      <StatusBadge
        status={option.value}
        label={option.label}
        tone={option.tone}
      />
    );
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.icon}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

type CommonProps = AriaAttributes & {
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  loadOptions?: (query: string) => Promise<Option[]>;
  /**
   * Stable React Query key for remote options (the search text is appended).
   * Defaults to a key derived from `id`; pass it when `id` is omitted and the
   * cache should survive remounts.
   */
  queryKey?: readonly unknown[];
  /** Multiple mode: show a checkbox per row instead of a check mark. */
  checkboxes?: boolean;
  /** Multiple mode: trigger shows one selected label/badge or "N selected". */
  summarize?: boolean;
  /** Adds a clear row at the bottom of the list while anything is selected. */
  clearLabel?: string;
  id?: string;
  onBlur?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  /** Muted prefix inside the trigger, e.g. "Status", for compact filter bars. */
  triggerLabel?: string;
  className?: string;
};
export type ComboboxProps = CommonProps &
  (
    | {
        multiple?: false;
        value: string | null;
        onChange: (value: string | null) => void;
      }
    | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  );

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Choose an option",
    searchPlaceholder = "Search…",
    emptyText = "No options found.",
    disabled,
    clearable,
    loadOptions,
    queryKey,
    checkboxes,
    summarize,
    clearLabel,
    multiple,
    value,
    onBlur,
    ref,
    id,
    triggerLabel,
    className,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const cache = useRef(new Map<string, Option>());
  const listId = useId();
  const selectedValues = multiple ? value : value === null ? [] : [value];

  useEffect(() => {
    for (const option of options) cache.current.set(option.value, option);
  }, [options]);

  useEffect(() => {
    if (!query) {
      setDebounced("");
      return;
    }
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const remote = useQuery({
    queryKey: [...(queryKey ?? ["combobox", id ?? listId]), debounced],
    queryFn: () => (loadOptions as NonNullable<typeof loadOptions>)(debounced),
    enabled: Boolean(loadOptions) && open,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const remoteOptions = remote.data;
  if (remoteOptions)
    for (const option of remoteOptions) cache.current.set(option.value, option);
  const active = Boolean(loadOptions) && open;
  const loading = active && remote.isPending;
  const refetching =
    active && !loading && (remote.isFetching || query !== debounced);
  const error =
    active && remote.isError && !remoteOptions
      ? "Unable to load options. Try searching again."
      : undefined;

  const available = new Map(
    (loadOptions ? (remoteOptions ?? []) : options).map((option) => [
      option.value,
      option,
    ]),
  );
  for (const selected of selectedValues) {
    const option =
      options.find((option) => option.value === selected) ??
      cache.current.get(selected);
    if (option && !available.has(selected)) available.set(selected, option);
  }
  function choose(option: Option) {
    cache.current.set(option.value, option);
    if (props.multiple)
      props.onChange(
        props.value.includes(option.value)
          ? props.value.filter((value) => value !== option.value)
          : [...props.value, option.value],
      );
    else {
      props.onChange(
        clearable && props.value === option.value ? null : option.value,
      );
      setOpen(false);
    }
  }
  function clearAll() {
    if (props.multiple) props.onChange([]);
    else {
      props.onChange(null);
      setOpen(false);
    }
  }
  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          onBlur?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label={props["aria-label"] ?? (id ? undefined : placeholder)}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={props["aria-invalid"]}
          aria-required={props["aria-required"]}
          id={id}
          ref={ref}
          type="button"
          role="combobox"
          aria-expanded={open && !disabled}
          aria-controls={listId}
          aria-haspopup="listbox"
          disabled={disabled}
          variant="outline"
          className={cn(
            "h-auto min-h-8 w-full justify-between font-normal",
            className,
          )}
          onBlur={onBlur}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {triggerLabel && (
              <span className="text-muted-foreground">
                {triggerLabel}
                {selectedValues.length ? ":" : ""}
              </span>
            )}
            {selectedValues.length
              ? summarize && multiple && selectedValues.length > 1
                ? `${selectedValues.length} selected`
                : selectedValues.map((selected) => {
                    const option = available.get(selected) ?? {
                      value: selected,
                      label: selected,
                    };
                    return multiple && !summarize && !option.tone ? (
                      <Badge key={selected} variant="secondary">
                        {option.icon}
                        {option.label}
                      </Badge>
                    ) : (
                      <span key={selected} className="flex min-w-0">
                        <OptionVisual option={option} />
                      </span>
                    );
                  })
              : !triggerLabel && placeholder}
          </span>
          <ChevronsUpDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={!loadOptions}>
          <div className="relative">
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
            />
            {refetching && (
              <Spinner className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
          {loading && (
            <output className="flex items-center gap-2 p-3 text-sm">
              <Spinner />
              Loading options…
            </output>
          )}
          {error && (
            <p role="alert" className="p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <CommandList id={listId}>
            {!loading && !error && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {clearable && selectedValues.length > 0 && (
                <CommandItem
                  value="__clear_selection__"
                  keywords={["Clear selection"]}
                  onSelect={clearAll}
                >
                  Clear selection
                </CommandItem>
              )}
              {[...available.values()].map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description ?? ""]}
                  disabled={option.disabled}
                  onSelect={() => choose(option)}
                >
                  {multiple && checkboxes && (
                    <Checkbox
                      aria-hidden
                      tabIndex={-1}
                      className="pointer-events-none"
                      checked={selectedValues.includes(option.value)}
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <OptionVisual option={option} />
                    {option.description && (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {!(multiple && checkboxes) &&
                    selectedValues.includes(option.value) && (
                      <Check aria-label="Selected" />
                    )}
                </CommandItem>
              ))}
            </CommandGroup>
            {clearLabel && selectedValues.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear_filters__"
                    keywords={[clearLabel]}
                    onSelect={clearAll}
                  >
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
