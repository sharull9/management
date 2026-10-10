import "server-only";
import { paymentRequestApproval } from "@/modules/payment";
import { registerProcurementHandlers } from "@/modules/procurement";
import { resolveProjectManagers } from "@/modules/project";
import { expenseApproval } from "@/modules/project-cost";
import {
  taskDelayApproval,
  taskSubmissionApproval,
} from "@/modules/project-task";
import { salesInvoiceApproval } from "@/modules/sales-invoice";
import { vendorBillApproval } from "@/modules/vendor-bill";
import { registerManagerResolver } from "./authorization";
import { registerApprovalHandler } from "./handlers";

registerManagerResolver(resolveProjectManagers);
registerApprovalHandler("TASK_SUBMISSION", taskSubmissionApproval);
registerApprovalHandler("TASK_DELAY", taskDelayApproval);
registerApprovalHandler("EXPENSE", expenseApproval);
registerProcurementHandlers();
registerApprovalHandler("VENDOR_BILL", vendorBillApproval);
registerApprovalHandler("PAYMENT_REQUEST", paymentRequestApproval);
registerApprovalHandler("SALES_INVOICE", salesInvoiceApproval);
