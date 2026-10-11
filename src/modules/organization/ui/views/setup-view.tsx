import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthFrame } from "@/components/shared/auth-frame";
import { db } from "@/core/db";
import { SetupForm } from "@/modules/organization-auth/ui/components/setup-form";

export async function SetupView() {
  await connection();
  if (await db.user.count()) redirect("/sign-in");
  return (
    <AuthFrame
      title="Set up your platform"
      description="Create the first platform administrator. Tenant owners and members are added after setup."
    >
      <SetupForm />
    </AuthFrame>
  );
}
