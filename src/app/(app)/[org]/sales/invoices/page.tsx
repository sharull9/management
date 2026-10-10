import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrgContext } from "@/server/context";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  await requireOrgContext(org);
  return (
    <>
      <PageHeading title="Sales invoices" description="Coming soon" />
      <Card>
        <CardContent className="py-6">Coming soon</CardContent>
      </Card>
    </>
  );
}

export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
