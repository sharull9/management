"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { isNavigationSignal } from "@/components/shared/form/navigation-signal";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/organization-auth/server/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      try {
        const result = await signOutAction({}, new FormData());
        if (result.error) toast.error(result.error);
      } catch (error) {
        if (isNavigationSignal(error)) return;
        toast.error("Unable to sign out. Please try again.");
      }
    });
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={signOut}
      className="text-muted-foreground"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
