"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export function WorkspaceErrorView({ retry }: { retry: () => void }) {
  return (
    <main className="space-y-4 p-8">
      <h1 className="text-xl font-semibold">This workspace is unavailable</h1>
      <p className="text-sm text-muted-foreground">
        Your tenant may be suspended, or the database may be unavailable.
        Contact your administrator if retrying does not help.
      </p>
      <Button onClick={retry}>Try again</Button>
      <Link href="/" className="block text-sm underline">
        Organization picker
      </Link>
    </main>
  );
}
