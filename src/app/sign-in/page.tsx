import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { signInAction } from "@/server/actions";
export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-lg p-6 py-16">
      <p className="mb-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Management
      </p>
      <FormCard title="Sign in">
        <p className="mb-6 text-sm text-muted-foreground">
          Access your organizations and project workspace.
        </p>
        <ActionForm action={signInAction} submit="Sign in">
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
            required
            autoComplete="current-password"
          />
        </ActionForm>
      </FormCard>
      <p className="mt-6 text-sm text-muted-foreground">
        First installation?{" "}
        <Link href="/setup" className="underline underline-offset-4">
          Set up the platform
        </Link>
      </p>
    </main>
  );
}
