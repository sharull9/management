import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  ClipboardList,
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

/** Finds the group and link that own `pathname`, for breadcrumbs. */
export function findNavLocation(pathname: string, base: string) {
  for (const group of appNav)
    for (const link of group.links)
      if (isNavActive(pathname, base, link.path)) return { group, link };
  return undefined;
}
