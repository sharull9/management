"use client";
import { Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navButtonClass, navLabelClass } from "@/components/shared/app-shell";
import { RuneGlyph } from "@/components/shared/rune-glyph";
import type { RuneGlyphName } from "@/components/shared/rune-icons.generated";
import { UserMenu } from "@/components/shared/user-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const links: { title: string; href: string; glyph: RuneGlyphName }[] = [
  { title: "Overview", href: "/admin", glyph: "glass-chart-4-2" },
  { title: "Tenants", href: "/admin/tenants", glyph: "glass-people-4" },
];

export function AdminShell({
  user,
  hasWorkspaces,
  children,
}: {
  user: { name: string; email: string };
  hasWorkspaces: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  const current = links.find((link) => isActive(link.href));
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/admin">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.3)]">
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Management</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Platform administration
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className={navLabelClass}>
              Platform
            </SidebarGroupLabel>
            <SidebarMenu>
              {links.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(link.href)}
                    className={navButtonClass}
                  >
                    <Link href={link.href}>
                      <RuneGlyph name={link.glyph} />
                      <span>{link.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <UserMenu
            user={user}
            links={
              hasWorkspaces
                ? [{ title: "My organizations", href: "/", icon: Building2 }]
                : []
            }
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <nav aria-label="Breadcrumb" className="text-sm">
            <ol className="flex items-center gap-2">
              <li className="text-muted-foreground">Platform</li>
              {current && (
                <>
                  <li aria-hidden className="text-faint">
                    /
                  </li>
                  <li aria-current="page" className="font-medium">
                    {current.title}
                  </li>
                </>
              )}
            </ol>
          </nav>
        </header>
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
