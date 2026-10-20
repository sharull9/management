import { FormCard } from "@/components/shared/form-card";
import {
  CreateSheet,
  DetailSheet,
} from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { accountsData } from "../../server/queries";
import { AccountForm } from "../components/account-form";
import { AccountingTable } from "../components/accounting-table";
import {
  ApplyTemplatesButton,
  HistorySyncButton,
} from "../components/history-sync-button";

export async function AccountsView({ org }: { org: string }) {
  const data = await accountsData(org);
  const accounts = data.accounts.map((row) => ({
    id: row.id,
    code: row.code,
    name:
      data.canManage && !row.systemKey ? (
        <DetailSheet label={row.name} title={`Edit ${row.code}`}>
          <AccountForm
            org={org}
            account={{
              id: row.id,
              code: row.code,
              name: row.name,
              type: row.type,
              active: row.active,
            }}
          />
        </DetailSheet>
      ) : (
        row.name
      ),
    type: row.type,
    state: row.active ? "Active" : "Inactive",
    key: row.systemKey ?? "Custom",
  }));
  const templates = data.templates.map((row) => ({
    id: row.id,
    code: row.code,
    name: !row.systemKey ? (
      <DetailSheet label={row.name} title={`Edit ${row.code}`}>
        <AccountForm
          org={org}
          template
          account={{
            id: row.id,
            code: row.code,
            name: row.name,
            type: row.type,
            active: row.active,
          }}
        />
      </DetailSheet>
    ) : (
      row.name
    ),
    type: row.type,
    state: row.active ? "Active" : "Inactive",
  }));
  return (
    <>
      <PageHeading
        title="Chart of accounts"
        description={`Organization chart · ${data.ctx.org.baseCurrency}`}
        actions={
          data.canManage && (
            <>
              <ApplyTemplatesButton org={org} />
              <HistorySyncButton org={org} />
              <CreateSheet
                label="New account"
                description="Add a custom ledger account."
              >
                <AccountForm org={org} />
              </CreateSheet>
            </>
          )
        }
      />
      <FormCard
        title="Organization accounts"
        description="System accounts keep their assigned type and code. Custom accounts can be edited until they have posted activity."
      >
        <AccountingTable
          rows={accounts}
          columns={[
            { key: "code", label: "Code" },
            { key: "name", label: "Account" },
            { key: "type", label: "Type" },
            { key: "key", label: "Source" },
            { key: "state", label: "Status" },
          ]}
          empty="The chart is empty. Ask an accounting manager to initialize it."
        />
      </FormCard>
      {data.canManageTemplates && (
        <FormCard
          title="Tenant templates"
          description="Templates apply to organizations in this tenant. Existing accounts are left in place."
        >
          <div className="mb-3 flex justify-end">
            <CreateSheet label="New template">
              <AccountForm org={org} template />
            </CreateSheet>
          </div>
          <AccountingTable
            rows={templates}
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Template" },
              { key: "type", label: "Type" },
              { key: "state", label: "Status" },
            ]}
            empty="No tenant templates are configured."
          />
        </FormCard>
      )}
    </>
  );
}
