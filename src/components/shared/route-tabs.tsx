"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Line tabs that navigate between sibling routes; the longest match is active. */
export function RouteTabs({
  label,
  links,
}: {
  label: string;
  links: { title: string; href: string }[];
}) {
  const pathname = usePathname();
  const active = links
    .filter(
      (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <nav
      aria-label={label}
      className="-mx-1 overflow-x-auto overflow-y-hidden border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max gap-1 px-1">
        {links.map((link) => {
          const current = link === active;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  current &&
                    "text-foreground after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
                )}
              >
                {link.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
