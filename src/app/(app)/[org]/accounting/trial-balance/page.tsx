import { Suspense } from "react";
import { TrialBalanceView } from "@/modules/accounting/ui/views/reports-view";
export default function Page(props: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading trial balance…</p>
      }
    >
      <Content {...props} />
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
  return <TrialBalanceView org={org} searchParams={query} />;
}
