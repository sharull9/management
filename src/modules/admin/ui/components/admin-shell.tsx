"use client";
import { Building2, LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const links = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Tenants", href: "/admin/tenants", icon: Building2 },
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
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
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
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {links.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton asChild isActive={isActive(link.href)}>
                    <Link href={link.href}>
                      <link.icon />
                      <span>{link.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t">
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
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <nav aria-label="Breadcrumb" className="text-sm">
            <ol className="flex items-center gap-2">
              <li className="text-muted-foreground">Platform</li>
              {current && (
                <>
                  <li aria-hidden className="text-muted-foreground">
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
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
