import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <output className="block space-y-4 p-8" aria-label="Loading workspace">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full" />
    </output>
  );
}
