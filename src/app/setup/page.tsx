import { Suspense } from "react";
import { SetupView } from "@/modules/organization/ui/views/setup-view";

export default function SetupPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading setup…</p>}>
      <SetupView />
    </Suspense>
  );
}
