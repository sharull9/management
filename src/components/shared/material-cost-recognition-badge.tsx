import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Project } from "@/generated/prisma/client";
export function MaterialCostRecognitionBadge({
  mode,
}: {
  mode: Project["materialCostRecognition"];
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="inline-flex rounded-full border px-2.5 py-1 text-xs">
          Material costs:{" "}
          {mode === "ON_RECEIPT" ? "on receipt" : "on consumption"}
        </TooltipTrigger>
        <TooltipContent>
          {mode === "ON_RECEIPT"
            ? "Accepted GRNs recognize material costs. Transfers adjust costs; consumption only withdraws stock."
            : "Material consumption recognizes costs at moving average. GRNs and transfers only move stock."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
