import { Suspense } from "react";
import { JournalView } from "@/modules/accounting/ui/views/journal-view";
export default function Page({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading journal…</p>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
async function Content({
  params,
}: {
  params: Promise<{ org: string; id: string }>;
}) {
  const { org, id } = await params;
  return <JournalView org={org} id={id} />;
}
