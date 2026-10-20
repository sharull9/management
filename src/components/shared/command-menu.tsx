"use client";
import { formatForDisplay, useHotkey } from "@tanstack/react-hotkeys";
import { Building2, CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { AppNavGroup } from "./app-nav";

const OPEN_SHORTCUT = "Mod+K";

export function CommandMenu({
  orgSlug,
  organizations,
  nav,
}: {
  orgSlug: string;
  organizations: { name: string; slug: string }[];
  nav: AppNavGroup[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Platform-specific labels (⌘K vs Ctrl+K) are resolved after hydration.
  const [shortcut, setShortcut] = useState("");
  useEffect(() => setShortcut(formatForDisplay(OPEN_SHORTCUT)), []);
  useHotkey(OPEN_SHORTCUT, () => setOpen((value) => !value));
  const [active, setActive] = useState("");
  const activeHint = active.startsWith("organization ")
    ? "Switch organization"
    : "Go to page";
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <>
      <Button
        variant="outline"
        className="size-8 justify-center p-0 font-normal text-muted-foreground sm:h-8 sm:w-auto sm:min-w-0 sm:max-w-64 sm:flex-1 sm:shrink sm:justify-start sm:px-2.5"
        aria-label="Search pages and organizations"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
      >
        <Search data-icon="inline-start" />
        <span className="hidden flex-1 truncate text-left sm:block">
          Jump to…
        </span>
        {shortcut && (
          <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-block">
            {shortcut}
          </kbd>
        )}
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Jump to"
        description="Search pages and organizations"
        className="top-[15%] rounded-2xl! bg-popover shadow-2xl ring-4 ring-foreground/5 sm:max-w-xl"
      >
        <Command value={active} onValueChange={setActive}>
          <CommandInput placeholder="Search pages and organizations…" />
          <CommandList>
            <CommandEmpty>No matching pages.</CommandEmpty>
            {nav.map((group) => (
              <CommandGroup key={group.title} heading={group.title}>
                {group.links.map((link) => (
                  <CommandItem
                    key={link.path}
                    value={`${group.title} ${link.title}`}
                    onSelect={() => go(`/${orgSlug}${link.path}`)}
                  >
                    <link.icon />
                    <span className="truncate">{link.title}</span>
                    <CommandShortcut className="tracking-normal">
                      Go to page
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {organizations.length > 1 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Switch organization">
                  {organizations.map((org) => (
                    <CommandItem
                      key={org.slug}
                      value={`organization ${org.name}`}
                      onSelect={() => go(`/${org.slug}`)}
                    >
                      <Building2 />
                      <span className="truncate">{org.name}</span>
                      <CommandShortcut className="tracking-normal">
                        Switch organization
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-background px-1 shadow-xs">
                <CornerDownLeft className="size-3" />
                <span className="sr-only">Enter</span>
              </kbd>
              {activeHint}
            </span>
            <span aria-hidden className="h-4 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <kbd className="inline-flex h-5 items-center justify-center rounded border bg-background px-1.5 font-mono text-[10px] shadow-xs">
                Esc
              </kbd>
              Close
            </span>
            <span className="ml-auto hidden items-center gap-1.5 sm:flex">
              <kbd className="inline-flex h-5 items-center justify-center rounded border bg-background px-1.5 font-mono text-[10px] shadow-xs">
                ↑↓
              </kbd>
              Navigate
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
