import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { setupAction } from "@/server/actions";
import { db } from "@/server/db";

async function Setup() {
  await connection();
  if (await db.user.count()) redirect("/sign-in");
  return (
    <main className="mx-auto w-full max-w-lg p-6 py-16">
      <FormCard title="Set up your platform">
        <p className="mb-6 text-sm text-muted-foreground">
          Create the first platform administrator. Tenant owners and members are
          added after setup.
        </p>
        <ActionForm action={setupAction} submit="Create administrator">
          <Field label="Full name" name="name" required autoComplete="name" />
          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </ActionForm>
      </FormCard>
    </main>
  );
}
export default function SetupPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading setup…</p>}>
      <Setup />
    </Suspense>
  );
}
