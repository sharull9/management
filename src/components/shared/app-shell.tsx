"use client";
import {
  Bell,
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
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
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
import { markNotificationReadAction } from "@/modules/notifications/server/actions";
import { listNotifications } from "@/modules/notifications/server/queries";
import { UserMenu } from "./user-menu";

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
        <SidebarFooter className="border-t">
          <UserMenu
            user={user}
            links={[{ title: "All organizations", href: "/", icon: Building2 }]}
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">{org.name}</span>
          <NotificationBell key={org.slug} orgSlug={org.slug} />
        </header>
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function NotificationBell({ orgSlug }: { orgSlug: string }) {
  const [data, setData] = useState<
    Awaited<ReturnType<typeof listNotifications>>
  >({ unreadCount: 0, latest: [] });
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    listNotifications({ orgSlug })
      .then((result) => {
        if (active) {
          setData(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load notifications.");
      });
    return () => {
      active = false;
    };
  }, [orgSlug]);
  const reload = () =>
    startTransition(async () => {
      try {
        setData(await listNotifications({ orgSlug }));
        setLoaded(true);
        setError(undefined);
      } catch {
        setError("Unable to load notifications.");
      }
    });
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) reload();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-label={`Notifications, ${data.unreadCount} unread`}
        >
          <Bell className="size-4" />
          {data.unreadCount > 0 && (
            <span className="text-xs tabular-nums">{data.unreadCount}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-96 w-80 overflow-y-auto"
      >
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {error ? (
          <p role="alert" className="px-2 text-sm text-destructive">
            {error}
          </p>
        ) : !loaded ? (
          <output className="px-2 text-sm">Loading notifications...</output>
        ) : data.latest.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No notifications</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          data.latest.map((notification) => (
            <Item
              key={notification.id}
              size="sm"
              variant={notification.read ? "default" : "muted"}
            >
              <ItemContent>
                <DropdownMenuItem asChild>
                  <Link href={notification.href}>
                    <ItemTitle>{notification.title}</ItemTitle>
                  </Link>
                </DropdownMenuItem>
                <ItemDescription>{notification.body}</ItemDescription>
                {!notification.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          const result = await markNotificationReadAction({
                            orgSlug,
                            id: notification.id,
                          });
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          setData(await listNotifications({ orgSlug }));
                          setError(undefined);
                        } catch {
                          setError("Unable to mark notification as read.");
                        }
                      })
                    }
                  >
                    Mark as read
                  </Button>
                )}
              </ItemContent>
            </Item>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
