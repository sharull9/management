import { Suspense } from "react";
import { AccountsView } from "@/modules/accounting/ui/views/accounts-view";
export default function Page({ params }: { params: Promise<{ org: string }> }) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">
          Loading chart of accounts…
        </p>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <AccountsView org={org} />;
}
