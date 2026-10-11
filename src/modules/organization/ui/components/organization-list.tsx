"use client";
import { ChevronRight, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export type OrganizationListRow = {
  id: string;
  name: string;
  slug: string;
  tenantId: string;
  tenantName: string;
  location: string | null;
  baseCurrency: string;
  activeProjects: number;
};

/** Search appears only once scanning the list by eye gets slow. */
const SEARCH_THRESHOLD = 7;

const monogramTones = [
  "bg-tag-blue text-tag-blue-fg ring-tag-blue-border",
  "bg-tag-purple text-tag-purple-fg ring-tag-purple-border",
  "bg-tag-green text-tag-green-fg ring-tag-green-border",
  "bg-tag-amber text-tag-amber-fg ring-tag-amber-border",
  "bg-tag-teal text-tag-teal-fg ring-tag-teal-border",
  "bg-tag-red text-tag-red-fg ring-tag-red-border",
];

function monogram(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words[0][0] + words[1][0]
      : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function tone(slug: string) {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return monogramTones[hash % monogramTones.length];
}

function projectCount(count: number) {
  if (count === 0) return "No active projects";
  return `${count} active ${count === 1 ? "project" : "projects"}`;
}

function OrganizationRow({ org }: { org: OrganizationListRow }) {
  return (
    <li>
      <Link
        href={`/${org.slug}`}
        className="group flex items-center gap-4 px-4 py-3.5 outline-none transition-colors duration-100 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <span
          aria-hidden
          className={`flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold ring-1 ring-inset ${tone(org.slug)}`}
        >
          {monogram(org.name)}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-[0.9375rem] font-medium">
            {org.name}
          </span>
          <span className="truncate text-[0.8125rem] text-muted-foreground">
            {org.location ?? `/${org.slug}`}
          </span>
        </span>
        <span className="hidden shrink-0 text-right text-[0.8125rem] text-muted-foreground tabular-nums sm:block">
          {projectCount(org.activeProjects)}
        </span>
        <span className="shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {org.baseCurrency}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
        />
      </Link>
    </li>
  );
}

export function OrganizationList({ orgs }: { orgs: OrganizationListRow[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const visible = deferredQuery
    ? orgs.filter((org) =>
        [org.name, org.tenantName, org.location ?? "", org.slug].some((value) =>
          value.toLowerCase().includes(deferredQuery),
        ),
      )
    : orgs;
  const groups = new Map<string, OrganizationListRow[]>();
  for (const org of visible) {
    groups.set(org.tenantId, [...(groups.get(org.tenantId) ?? []), org]);
  }
  const showGroupHeadings = new Set(orgs.map((org) => org.tenantId)).size > 1;

  return (
    <div className="space-y-6">
      {orgs.length >= SEARCH_THRESHOLD && (
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an organization or location"
            aria-label="Find an organization"
          />
        </InputGroup>
      )}
      {[...groups.values()].map((rows) => (
        <section key={rows[0].tenantId} className="space-y-2">
          {showGroupHeadings && (
            <h2 className="flex items-baseline justify-between px-1 text-sm font-medium">
              {rows[0].tenantName}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {rows.length}{" "}
                {rows.length === 1 ? "organization" : "organizations"}
              </span>
            </h2>
          )}
          <ul
            aria-label={rows[0].tenantName}
            className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs"
          >
            {rows.map((org) => (
              <OrganizationRow key={org.id} org={org} />
            ))}
          </ul>
        </section>
      ))}
      {deferredQuery && !visible.length && (
        <EmptyState
          title="No organizations match your search"
          description="Check the spelling, or search by company or city instead."
        />
      )}
    </div>
  );
}
