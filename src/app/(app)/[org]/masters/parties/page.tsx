import { Suspense } from "react";
import { PartyMasters } from "@/components/master-forms";
import { PageHeading } from "@/components/shared/page-heading";
import Loading from "@/components/shared/page-loading";
import { masterData } from "@/server/masters/queries";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Parties"
        description="Shared across organizations in this tenant."
      />
      <PartyMasters org={org} data={data} />
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
