import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { BillsList } from "@/modules/vendor-bill/ui/views/bills-list-view";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org } = await params;
  const search = await searchParams;
  const single = (key: string) =>
    typeof search[key] === "string" ? (search[key] as string) : undefined;
  return (
    <BillsList
      org={org}
      filters={{
        projectId: single("projectId"),
        partyId: single("partyId"),
        status: single("status"),
        overdue: single("overdue"),
      }}
    />
  );
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
