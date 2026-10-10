import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { NumberingView } from "@/modules/organization/ui/views/numbering-view";

async function NumberingPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <NumberingView org={org} />;
}
export default function Page(props: Parameters<typeof NumberingPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <NumberingPage {...props} />
    </Suspense>
  );
}
