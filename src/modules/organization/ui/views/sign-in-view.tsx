import Link from "next/link";
import { AuthFrame } from "@/components/shared/auth-frame";
import { SignInForm } from "@/modules/organization-auth/ui/components/sign-in-form";
export function SignInView() {
  return (
    <AuthFrame
      title="Sign in to Management"
      description="Access your organizations and project workspace."
      footer={
        <>
          First installation?{" "}
          <Link
            href="/setup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Set up the platform
          </Link>
        </>
      }
    >
      <SignInForm />
    </AuthFrame>
  );
}
