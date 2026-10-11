import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FormCard } from "@/components/shared/form-card";
import { db } from "@/core/db";
import { SetupForm } from "@/modules/organization-auth/ui/components/setup-form";

export async function SetupView() {
  await connection();
  if (await db.user.count()) redirect("/sign-in");
  return (
    <main className="mx-auto w-full max-w-lg p-6 py-16">
      <FormCard title="Set up your platform">
        <p className="mb-6 text-sm text-muted-foreground">
          Create the first platform administrator. Tenant owners and members are
          added after setup.
        </p>
        <SetupForm />
      </FormCard>
    </main>
  );
}
