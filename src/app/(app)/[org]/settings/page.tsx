import { redirect } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/(app)/loading";

async function SettingsPage({ params }: { params: Promise<{ org: string }> }) {
  return redirect(`/${(await params).org}/settings/organizations`);
}

export default function Page(props: Parameters<typeof SettingsPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsPage {...props} />
    </Suspense>
  );
}
