"use client";
import { Building2, Check, ChevronsUpDown, HardHat } from "lucide-react";
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
import { appNav, findNavLocation, isNavActive } from "./app-nav";
import { CommandMenu } from "./command-menu";
import { NotificationBell } from "./notification-bell";
import { RuneGlyph } from "./rune-glyph";
import { UserMenu } from "./user-menu";

export const navButtonClass =
  "h-[30px] gap-2 text-sidebar-foreground hover:text-sidebar-accent-foreground [&>svg]:text-faint hover:[&>svg]:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary/12 data-[active=true]:text-[color-mix(in_oklab,var(--sidebar-primary)_70%,var(--foreground))] data-[active=true]:shadow-[0_0_0_1px_color-mix(in_oklab,var(--sidebar-primary)_28%,transparent)] data-[active=true]:hover:bg-sidebar-primary/16 data-[active=true]:[&>svg]:text-sidebar-primary data-[active=true]:[--glyph-light:color-mix(in_oklab,var(--sidebar-primary)_40%,white)] data-[active=true]:[--glyph-mid:var(--sidebar-primary)] data-[active=true]:[--glyph-shade:var(--sidebar-primary)] data-[active=true]:[--glyph-deep:color-mix(in_oklab,var(--sidebar-primary)_55%,black)]";
export const navLabelClass =
  "h-7 text-[11px] font-medium tracking-[0.08em] text-faint uppercase";

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
  const base = `/${org.slug}`;
  const location = findNavLocation(pathname, base);
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-3 border-b p-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.3)]">
              <HardHat className="size-4" />
            </span>
            <span className="grid min-w-0 leading-tight">
              <span className="truncate text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
                Management
              </span>
              <span className="truncate text-xs text-sidebar-foreground">
                Projects &amp; costing
              </span>
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg border bg-background/60 p-2 text-left text-sm outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground">
                {org.name.charAt(0).toUpperCase()}
              </span>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-medium text-sidebar-accent-foreground">
                  {org.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground">
                  {org.tenantName}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-faint" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            >
              <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
              {organizations.map((item) => (
                <DropdownMenuItem key={item.slug} asChild>
                  <Link href={`/${item.slug}`}>
                    <Building2 />
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.slug === org.slug && <Check />}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/">All organizations</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarHeader>
        <SidebarContent className="gap-0 py-1">
          {appNav.map((group) => (
            <SidebarGroup key={group.title} className="py-1.5">
              <SidebarGroupLabel className={navLabelClass}>
                {group.title}
              </SidebarGroupLabel>
              <SidebarMenu className="gap-px">
                {group.links.map((link) => (
                  <SidebarMenuItem key={link.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavActive(pathname, base, link.path)}
                      className={navButtonClass}
                    >
                      <Link href={`${base}${link.path}`}>
                        <RuneGlyph name={link.glyph} />
                        <span>{link.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <UserMenu
            user={user}
            links={[{ title: "All organizations", href: "/", icon: Building2 }]}
          />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4!" />
          <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
            <ol className="flex items-center gap-1.5">
              <li className="hidden truncate text-muted-foreground sm:block">
                <Link href={base} className="hover:text-foreground">
                  {org.name}
                </Link>
              </li>
              {location && (
                <>
                  <li aria-hidden className="hidden text-faint sm:block">
                    /
                  </li>
                  <li className="hidden text-muted-foreground md:block">
                    {location.group.title}
                  </li>
                  <li aria-hidden className="hidden text-faint md:block">
                    /
                  </li>
                  <li className="truncate font-medium">
                    <Link
                      href={`${base}${location.link.path}`}
                      aria-current={
                        pathname === `${base}${location.link.path}`
                          ? "page"
                          : undefined
                      }
                    >
                      {location.link.title}
                    </Link>
                  </li>
                </>
              )}
            </ol>
          </nav>
          <div className="ml-auto flex flex-1 items-center justify-end gap-2">
            <CommandMenu orgSlug={org.slug} organizations={organizations} />
            <NotificationBell key={org.slug} orgSlug={org.slug} />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
