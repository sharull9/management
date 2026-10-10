import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { UomMasters } from "@/components/master-forms";
import { PageHeading } from "@/components/page-heading";
import { masterData } from "@/server/masters/queries";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="UOM groups and units"
        description="Shared across organizations in this tenant."
      />
      <UomMasters org={org} data={data} />
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
