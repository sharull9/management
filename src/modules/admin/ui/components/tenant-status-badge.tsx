import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
export function TenantStatusBadge({
  status,
}: {
  status: "ACTIVE" | "SUSPENDED";
}) {
  const active = status === "ACTIVE";
  return (
    <Badge variant={active ? "outline" : "destructive"}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-destructive",
        )}
      />
      {active ? "Active" : "Suspended"}
    </Badge>
  );
}
