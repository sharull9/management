import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { CategoryMasters } from "@/components/master-forms";
import { PageHeading } from "@/components/page-heading";
import { masterData } from "@/server/masters/queries";

async function Content({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const data = await masterData(org);
  return (
    <>
      <PageHeading
        title="Item categories"
        description="Shared across organizations in this tenant."
      />
      <CategoryMasters org={org} data={data} />
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
