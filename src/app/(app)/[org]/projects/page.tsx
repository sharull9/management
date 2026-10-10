import { PageHeading } from "@/components/page-heading";
export default function ProjectsPage() {
  return (
    <>
      <PageHeading
        title="Projects"
        description="Project planning, stages, tasks and costing arrive in Phase 2."
      />
      <p className="rounded-lg border p-6 text-sm text-muted-foreground">
        Your foundation is ready. No projects have been created.
      </p>
    </>
  );
}
