import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { TenantsView } from "@/modules/admin/ui/views/tenants-view";
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <TenantsView />
    </Suspense>
  );
}
