import { Suspense } from "react";
import { JournalsView } from "@/modules/accounting/ui/views/journals-view";
export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">
          Loading journal register…
        </p>
      }
    >
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ org }, query] = await Promise.all([params, searchParams]);
  return <JournalsView org={org} searchParams={query} />;
}
