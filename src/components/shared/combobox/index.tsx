"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
  type AriaAttributes,
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

export type Option = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};
type CommonProps = AriaAttributes & {
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  loadOptions?: (query: string) => Promise<Option[]>;
  id?: string;
  onBlur?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
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
    multiple,
    value,
    onBlur,
    ref,
    id,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteOptions, setRemoteOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const cache = useRef(new Map<string, Option>());
  const listId = useId();
  const selectedValues = multiple ? value : value === null ? [] : [value];

  useEffect(() => {
    for (const option of options) cache.current.set(option.value, option);
  }, [options]);

  useEffect(() => {
    if (!loadOptions || !open) return;
    let active = true;
    setLoading(true);
    setError(undefined);
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const loaded = await loadOptions(query);
          if (!active) return;
          for (const option of loaded) cache.current.set(option.value, option);
          setRemoteOptions(loaded);
        } catch {
          if (active) {
            setRemoteOptions([]);
            setError("Unable to load options. Try searching again.");
          }
        } finally {
          if (active) setLoading(false);
        }
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadOptions, query, open]);

  const available = new Map(
    (loadOptions ? remoteOptions : options).map((option) => [
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
          className="h-auto min-h-9 w-full justify-between"
          onBlur={onBlur}
        >
          <span className="flex min-w-0 flex-wrap gap-1">
            {selectedValues.length
              ? selectedValues.map((selected) => {
                  const label = available.get(selected)?.label ?? selected;
                  return multiple ? (
                    <Badge key={selected} variant="secondary">
                      {label}
                    </Badge>
                  ) : (
                    <span key={selected} className="truncate">
                      {label}
                    </span>
                  );
                })
              : placeholder}
          </span>
          <ChevronsUpDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={!loadOptions}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
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
                  onSelect={() => {
                    if (props.multiple) props.onChange([]);
                    else {
                      props.onChange(null);
                      setOpen(false);
                    }
                  }}
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
                  <span className="flex flex-1 flex-col">
                    <span>{option.label}</span>
                    {option.description && (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selectedValues.includes(option.value) && (
                    <Check aria-label="Selected" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { ComboboxField } from "./combobox-field";
