"use client";

import { parseAsString, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type UrlTab = {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
};

/**
 * Line tabs whose selection is stored in `?tab=` so reloads and shared links
 * keep the open tab. Content may be server-rendered.
 */
export function UrlTabs({
  tabs,
  param = "tab",
  actions,
}: {
  tabs: UrlTab[];
  param?: string;
  /** Rendered at the end of the tab strip, e.g. a create button. */
  actions?: ReactNode;
}) {
  const first = tabs[0]?.value ?? "";
  // Tab content is already rendered, so switching is a shallow URL update.
  const [requested, setRequested] = useQueryState(
    param,
    parseAsString
      .withDefault(first)
      .withOptions({ clearOnDefault: true, history: "replace", scroll: false }),
  );
  const value = tabs.some((tab) => tab.value === requested) ? requested : first;
  return (
    <Tabs value={value} onValueChange={setRequested} className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b">
        <TabsList variant="line" className="h-10 gap-4 px-0">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-0.5">
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {actions && (
          <div className="flex items-center gap-2 pb-2">{actions}</div>
        )}
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-6">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
