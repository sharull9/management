import Link from "next/link";
import type { ReactNode } from "react";
import { requireProjectContext } from "@/core/context";
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
  return (
    <>
      <div className="space-y-3">
        <Link className="text-sm underline" href={`/${org}/projects`}>
          All projects
        </Link>
        <h1 className="text-xl font-semibold">
          {ctx.project.code} · {ctx.project.name}
        </h1>
        <nav
          aria-label="Project sections"
          className="flex flex-wrap gap-2 border-b pb-3"
        >
          {[
            "Overview",
            "Stages",
            "Tasks",
            "Team",
            "Attendance",
            "Costs",
            "Budget",
            "Sites",
            "Materials",
          ].map((tab) => (
            <Link
              key={tab}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              href={`/${org}/projects/${projectId}${tab === "Overview" ? "" : `/${tab.toLowerCase()}`}`}
            >
              {tab}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
