import { Suspense } from "react";
import { ProfitLossView } from "@/modules/accounting/ui/views/reports-view";
export default function Page(props: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">
          Loading profit and loss…
        </p>
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
  return <ProfitLossView org={org} searchParams={query} />;
}
