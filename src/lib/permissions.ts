export const permissionGroups = {
  Projects: {
    "project.view": "View projects",
    "project.create": "Create projects",
    "project.manage": "Manage projects",
    "project.edit": "Edit projects",
    "stage.manage": "Manage stages",
    "task.manage": "Manage tasks",
    "task.submit": "Submit task work",
    "task.delay.request": "Request task delays",
  },
  Workforce: {
    "workforce.view": "View workforce",
    "workforce.manage": "Manage workforce",
    "attendance.record": "Record attendance",
  },
  Costs: {
    "expense.view": "View expenses",
    "expense.create": "Create expenses",
    "expense.manage": "Manage expenses",
    "cost.view": "View cost ledger and budgets",
  },
  Approvals: {
    "approval.view": "View approvals",
    "approval.policy.manage": "Manage approval policies",
  },
  Procurement: {
    "purchase.view": "View purchases",
    "purchase.request": "Create purchase requests",
    "purchase.manage": "Manage orders and receipts",
    "bill.manage": "Manage vendor bills",
    "payment.manage": "Manage payments",
  },
  Inventory: {
    "stock.view": "View stock",
    "stock.manage": "Manage consumption and transfers",
  },
  Sales: { "sales.view": "View sales", "sales.manage": "Manage invoices" },
  Assets: {
    "asset.view": "View vehicles and machinery",
    "asset.manage": "Manage assets",
    "asset.log": "Record usage and fuel",
  },
  Accounting: {
    "accounting.view": "View accounts and reports",
    "accounting.manage": "Manage accounts",
    "journal.create": "Create journals",
  },
  Administration: {
    "masters.manage": "Manage shared masters",
    "settings.manage": "Manage organization settings",
    "members.manage": "Manage members",
    "roles.manage": "Manage custom roles",
  },
} as const;
export const permissionKeys = Object.values(permissionGroups).flatMap((group) =>
  Object.keys(group),
);
