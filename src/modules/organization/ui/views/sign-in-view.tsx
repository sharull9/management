import Link from "next/link";
import { FormCard } from "@/components/shared/form-card";
import { SignInForm } from "@/modules/organization-auth/ui/components/sign-in-form";
export function SignInView() {
  return (
    <main className="mx-auto w-full max-w-lg p-6 py-16">
      <p className="mb-8 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Management
      </p>
      <FormCard title="Sign in">
        <p className="mb-6 text-sm text-muted-foreground">
          Access your organizations and project workspace.
        </p>
        <SignInForm />
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
