import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RouteTabs } from "@/components/shared/route-tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireProjectContext } from "@/core/context";

const sections = [
  "Overview",
  "Stages",
  "Tasks",
  "Team",
  "Attendance",
  "Costs",
  "Budget",
  "Sites",
  "Assets",
  "Materials",
];

export async function ProjectOverviewLayout({
  org,
  projectId,
  children,
}: {
  org: string;
  projectId: string;
  children: ReactNode;
}) {
  const ctx = await requireProjectContext(org, projectId);
  const base = `/${org}/projects/${projectId}`;
  return (
    <>
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          href={`/${org}/projects`}
        >
          <ArrowLeft className="size-4" />
          All projects
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {ctx.project.code}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ctx.project.name}
          </h1>
          <StatusBadge status={ctx.project.status} />
        </div>
        <RouteTabs
          label="Project sections"
          links={sections.map((title) => ({
            title,
            href:
              title === "Overview" ? base : `${base}/${title.toLowerCase()}`,
          }))}
        />
      </div>
      {children}
    </>
  );
}
