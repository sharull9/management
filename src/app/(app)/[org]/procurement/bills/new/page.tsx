import { Suspense } from "react";
import { NewBill } from "@/components/bills/pages";
import Loading from "@/components/shared/page-loading";

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org } = await params;
  const { po } = await searchParams;
  return <NewBill org={org} po={typeof po === "string" ? po : undefined} />;
}
export default function Page(props: Parameters<typeof Content>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <Content {...props} />
    </Suspense>
  );
}
