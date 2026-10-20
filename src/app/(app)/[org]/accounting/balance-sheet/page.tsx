import { Suspense } from "react";
import { BalanceSheetView } from "@/modules/accounting/ui/views/reports-view";
export default function Page(props: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading balance sheet…</p>
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
  return <BalanceSheetView org={org} searchParams={query} />;
}
