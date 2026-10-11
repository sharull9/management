import { AdminLayout } from "@/modules/admin/ui/layouts/admin-layout";
export const instant = false;
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
