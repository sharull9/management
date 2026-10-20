import "server-only";
import { journalApproval } from "@/modules/accounting/server/approval";
import { paymentRequestApproval } from "@/modules/payment/server/approval";
import { registerProcurementHandlers } from "@/modules/procurement/server/approval";
import { resolveProjectManagers } from "@/modules/project/server/approval";
import { expenseApproval } from "@/modules/project-cost/server/approval";
import {
  taskDelayApproval,
  taskSubmissionApproval,
} from "@/modules/project-task/server/approval";
import { salesInvoiceApproval } from "@/modules/sales-invoice/server/approval";
import { vendorBillApproval } from "@/modules/vendor-bill/server/approval";
import { registerManagerResolver } from "./authorization";
import { registerApprovalHandler } from "./handlers";

registerManagerResolver(resolveProjectManagers);
registerApprovalHandler("TASK_SUBMISSION", taskSubmissionApproval);
registerApprovalHandler("TASK_DELAY", taskDelayApproval);
registerApprovalHandler("EXPENSE", expenseApproval);
registerProcurementHandlers(registerApprovalHandler);
registerApprovalHandler("VENDOR_BILL", vendorBillApproval);
registerApprovalHandler("PAYMENT_REQUEST", paymentRequestApproval);
registerApprovalHandler("SALES_INVOICE", salesInvoiceApproval);
registerApprovalHandler("JOURNAL", journalApproval);
