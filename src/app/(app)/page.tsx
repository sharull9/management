import { Suspense } from "react";
import Loading from "@/components/shared/page-loading";
import { OrganizationPickerView } from "@/modules/organization/ui/views/organization-picker-view";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <OrganizationPickerView />
    </Suspense>
  );
}
