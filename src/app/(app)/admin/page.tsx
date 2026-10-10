import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { AdminView } from "@/modules/admin/ui/views/admin-view";
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminView />
    </Suspense>
  );
}
