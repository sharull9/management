"use client";
import {
  Building2,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { signOutAction } from "@/modules/organization-auth/server/actions";
import { ActionForm } from "./action-form";

export function AppShell({
  org,
  organizations,
  user,
  children,
}: {
  org: { name: string; slug: string; tenantName: string };
  organizations: { name: string; slug: string }[];
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const links = [
    { title: "Dashboard", path: "", icon: LayoutDashboard },
    { title: "Projects", path: "/projects", icon: FolderKanban },
    { title: "Approvals", path: "/approvals", icon: ListChecks },
    { title: "Workforce", path: "/workforce", icon: Users },
    { title: "Settings", path: "/settings", icon: Settings },
  ];
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b p-4">
          <p className="text-sm font-semibold text-muted-foreground">
            Management
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm font-medium hover:bg-accent">
              <Building2 className="size-4 shrink-0" />
              <span className="truncate">{org.name}</span>
              <ChevronDown className="ml-auto size-4 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
              {organizations.map((item) => (
                <DropdownMenuItem key={item.slug} asChild>
                  <Link href={`/${item.slug}`}>{item.name}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">All organizations</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="truncate text-xs text-muted-foreground">
            {org.tenantName}
          </p>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              {links.map((link) => {
                const href = `/${org.slug}${link.path}`;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === href ||
                        (!!link.path && pathname.startsWith(`${href}/`))
                      }
                    >
                      <Link href={href}>
                        <link.icon />
                        <span>{link.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
          {[
            {
              title: "Procurement",
              links: [
                ["Purchase requests", "procurement/requests"],
                ["Purchase orders", "procurement/orders"],
                ["Goods receipts", "procurement/receipts"],
                ["Vendor bills", "procurement/bills"],
                ["Payments", "finance/payments"],
                ["Payment requests", "finance/payment-requests"],
              ],
            },
            {
              title: "Sales",
              links: [
                ["Invoices", "sales/invoices"],
                ["Receipts", "sales/receipts"],
                ["Balances", "finance/balances"],
              ],
            },
            {
              title: "Inventory",
              links: [
                ["Stock", "inventory/stock"],
                ["Consumption", "inventory/consumption"],
                ["Transfers", "inventory/transfers"],
              ],
            },
            {
              title: "Masters",
              links: [
                ["UOMs", "masters/uoms"],
                ["Categories", "masters/categories"],
                ["Item levels", "masters/levels"],
                ["Items", "masters/items"],
                ["Parties", "masters/parties"],
                ["Tax", "masters/tax"],
                ["Locations", "masters/locations"],
              ],
            },
          ].map((group) => (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarMenu>
                {group.links.map(([title, path]) => (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(`/${org.slug}/${path}`)}
                    >
                      <Link href={`/${org.slug}/${path}`}>
                        <MapPin />
                        <span>{title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full truncate rounded-md p-2 text-left text-sm hover:bg-accent">
              {user.name}
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/">Organization picker</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="p-2">
                <ActionForm action={signOutAction} submit="Sign out" />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">{org.name}</span>
        </header>
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
