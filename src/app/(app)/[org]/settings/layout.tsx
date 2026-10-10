import Link from "next/link";
export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return (
    <>
      <nav aria-label="Settings" className="flex flex-wrap gap-2 border-b pb-4">
        {[
          "organizations",
          "members",
          "roles",
          "approval-policies",
          "numbering",
        ].map((section) => (
          <Link
            key={section}
            href={`/${org}/settings/${section}`}
            className="rounded-md px-3 py-2 text-sm capitalize hover:bg-muted"
          >
            {section.replaceAll("-", " ")}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
