import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Coins,
  Contact,
  FileText,
  FolderKanban,
  HandCoins,
  Layers,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MapPin,
  Package,
  PackageCheck,
  PackageMinus,
  Percent,
  ReceiptText,
  Ruler,
  Scale,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { RuneGlyphName } from "./rune-icons.generated";

export type AppNavLink = {
  title: string;
  path: string;
  icon: LucideIcon;
  /** RuneIcons glass glyph shown in the sidebar. */
  glyph: RuneGlyphName;
  /** Permission required to see the link; admins always see it. */
  permission?: string;
  permissionsAny?: string[];
};
export type AppNavGroup = { title: string; links: AppNavLink[] };

export const appNav: AppNavGroup[] = [
  {
    title: "Workspace",
    links: [
      {
        title: "Dashboard",
        path: "",
        icon: LayoutDashboard,
        glyph: "glass-home-round-door-2",
      },
      {
        title: "Projects",
        path: "/projects",
        icon: FolderKanban,
        glyph: "glass-folder",
      },
      {
        title: "Approvals",
        path: "/approvals",
        icon: ListChecks,
        glyph: "glass-square-check-2",
      },
      {
        title: "Workforce",
        path: "/workforce",
        icon: Users,
        glyph: "glass-people-3",
      },
      {
        title: "Assets",
        path: "/assets",
        icon: Truck,
        glyph: "glass-archive",
        permission: "asset.view",
      },
    ],
  },
  {
    title: "Procurement",
    links: [
      {
        title: "Purchase requests",
        path: "/procurement/requests",
        icon: ClipboardList,
        glyph: "glass-clipboard",
      },
      {
        title: "Purchase orders",
        path: "/procurement/orders",
        icon: ShoppingCart,
        glyph: "glass-shopping-bag",
      },
      {
        title: "Goods receipts",
        path: "/procurement/receipts",
        icon: PackageCheck,
        glyph: "glass-archive",
      },
      {
        title: "Vendor bills",
        path: "/procurement/bills",
        icon: ReceiptText,
        glyph: "glass-receipt-bill",
      },
      {
        title: "Payments",
        path: "/finance/payments",
        icon: Banknote,
        glyph: "glass-credit-card",
      },
      {
        title: "Payment requests",
        path: "/finance/payment-requests",
        icon: HandCoins,
        glyph: "glass-coin-rupees-2",
      },
    ],
  },
  {
    title: "Sales",
    links: [
      {
        title: "Invoices",
        path: "/sales/invoices",
        icon: FileText,
        glyph: "glass-file-text",
      },
      {
        title: "Receipts",
        path: "/sales/receipts",
        icon: Wallet,
        glyph: "glass-wallet",
      },
      {
        title: "Balances",
        path: "/finance/balances",
        icon: Scale,
        glyph: "glass-pie-chart-2-2",
      },
    ],
  },
  {
    title: "Inventory",
    links: [
      {
        title: "Stock",
        path: "/inventory/stock",
        icon: Boxes,
        glyph: "glass-archive-1",
      },
      {
        title: "Consumption",
        path: "/inventory/consumption",
        icon: PackageMinus,
        glyph: "glass-share-arrow-down",
      },
      {
        title: "Transfers",
        path: "/inventory/transfers",
        icon: ArrowLeftRight,
        glyph: "glass-send",
      },
    ],
  },
  {
    title: "Accounting",
    links: [
      {
        title: "Accounts",
        path: "/accounting/accounts",
        icon: BookOpen,
        glyph: "glass-bookmark",
        permissionsAny: ["accounting.view", "accounting.manage"],
      },
      {
        title: "Journals",
        path: "/accounting/journals",
        icon: FileText,
        glyph: "glass-file-text",
        permissionsAny: ["accounting.view", "journal.create"],
      },
      {
        title: "Ledger",
        path: "/accounting/ledger",
        icon: Scale,
        glyph: "glass-pie-chart-2-2",
        permission: "accounting.view",
      },
      {
        title: "Trial balance",
        path: "/accounting/trial-balance",
        icon: Scale,
        glyph: "glass-chart-4-2",
        permission: "accounting.view",
      },
      {
        title: "Profit and loss",
        path: "/accounting/profit-loss",
        icon: CircleDollarSign,
        glyph: "glass-chart-4-2",
        permission: "accounting.view",
      },
      {
        title: "Balance sheet",
        path: "/accounting/balance-sheet",
        icon: Coins,
        glyph: "glass-chart-4-2",
        permission: "accounting.view",
      },
      {
        title: "Tax summary",
        path: "/accounting/tax",
        icon: Percent,
        glyph: "glass-file-bend-2",
        permission: "accounting.view",
      },
    ],
  },
  {
    title: "Masters",
    links: [
      {
        title: "Items",
        path: "/masters/items",
        icon: Package,
        glyph: "glass-bookmark",
      },
      {
        title: "Categories",
        path: "/masters/categories",
        icon: Tags,
        glyph: "glass-tag",
      },
      {
        title: "Item levels",
        path: "/masters/levels",
        icon: Layers,
        glyph: "glass-mountain",
      },
      {
        title: "UOMs",
        path: "/masters/uoms",
        icon: Ruler,
        glyph: "glass-compass-square-1",
      },
      {
        title: "Parties",
        path: "/masters/parties",
        icon: Contact,
        glyph: "glass-contacts-2",
      },
      {
        title: "Tax",
        path: "/masters/tax",
        icon: Percent,
        glyph: "glass-file-bend-2",
      },
      {
        title: "Locations",
        path: "/masters/locations",
        icon: MapPin,
        glyph: "glass-map-pin-2",
      },
    ],
  },
  {
    title: "Organization",
    links: [
      {
        title: "Currencies",
        path: "/settings/currencies",
        icon: Coins,
        glyph: "glass-coin-rupees-2",
        permission: "currency.manage",
      },
      {
        title: "Exchange rates",
        path: "/settings/exchange-rates",
        icon: CircleDollarSign,
        glyph: "glass-chart-4-2",
        permission: "exchangeRate.manage",
      },
      {
        title: "Settings",
        path: "/settings",
        icon: Settings,
        glyph: "glass-settings-gear-1-2",
      },
    ],
  },
];

/** True when `pathname` is the link's page or one of its descendants. */
export function isNavActive(pathname: string, base: string, path: string) {
  const href = `${base}${path}`;
  return pathname === href || (!!path && pathname.startsWith(`${href}/`));
}

/** Finds the group and most specific link that own `pathname`, for breadcrumbs. */
export function findNavLocation(pathname: string, base: string) {
  let best: { group: AppNavGroup; link: AppNavLink } | undefined;
  for (const group of appNav)
    for (const link of group.links)
      if (
        isNavActive(pathname, base, link.path) &&
        (!best || link.path.length > best.link.path.length)
      )
        best = { group, link };
  return best;
}

/** Drops links whose permission the user lacks; empty groups disappear. */
export function visibleNav(permissions: readonly string[]): AppNavGroup[] {
  const allowed = new Set(permissions);
  return appNav
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (link) =>
          (!link.permission || allowed.has(link.permission)) &&
          (!link.permissionsAny ||
            link.permissionsAny.some((key) => allowed.has(key))),
      ),
    }))
    .filter((group) => group.links.length > 0);
}
