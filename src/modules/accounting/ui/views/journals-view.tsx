import Link from "next/link";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
} from "@/components/shared/filter-bar/filter-bar";
import { FormCard } from "@/components/shared/form-card";
import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { ServerPagination } from "@/components/shared/server-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { db } from "@/core/db";
import type { ListParams } from "@/core/pagination";
import { accountsData, journalsData } from "../../server/queries";
import { JournalForm } from "../components/journal-form";

export async function JournalsView({
  org,
  searchParams = {},
}: {
  org: string;
  searchParams?: ListParams;
}) {
  const data = await journalsData(org, searchParams);
  const accountData = data.canCreate ? await accountsData(org) : null;
  const accountChoices =
    accountData?.accounts
      .filter((a) => a.active)
      .map(({ id, code, name }) => ({ id, code, name })) ?? [];
  const [projects, parties] = data.canCreate
    ? await Promise.all([
        db.project.findMany({
          where: { organizationId: data.ctx.org.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.party.findMany({
          where: { tenantId: data.ctx.tenant.id },
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" },
        }),
      ])
    : [[], []];
  const rows = data.journals.map((journal) => ({
    id: journal.id,
    code: journal.code,
    date: journal.date.toISOString().slice(0, 10),
    description: journal.description,
    type:
      journal.sourceType === "MANUAL"
        ? "Manual"
        : journal.sourceType.replaceAll("_", " "),
    status: journal.status,
    creator: journal.creator.name,
    reversal: journal.reversal
      ? `Reversed by ${journal.reversal.code}`
      : journal.reversalOf
        ? `Reversal of ${journal.reversalOf.code}`
        : "",
  }));
  return (
    <>
      <PageHeading
        title="Journal entries"
        description="Review manual journals and posted source entries."
        actions={
          data.canCreate &&
          accountChoices.length > 0 && (
            <CreateSheet
              label="New journal"
              description={`Draft a balanced entry in ${data.ctx.org.baseCurrency}.`}
              width="xl"
            >
              <JournalForm
                org={org}
                baseCurrency={data.ctx.org.baseCurrency}
                accounts={accountChoices}
                projects={projects}
                parties={parties.map((p) => ({
                  id: p.id,
                  name: p.displayName,
                }))}
              />
            </CreateSheet>
          )
        }
      />
      <FormCard
        title="Journal register"
        description="Drafts and pending entries stay out of financial reports until approval."
      >
        {data.canCreate && accountChoices.length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            There are no active accounts. An accounting manager must initialize
            the chart before you can draft a journal.
          </p>
        )}
        <FilterBar className="mb-4">
          <FilterSearch placeholder="Search number, description, or creator" />
          <FilterSelect
            name="sort"
            label="Sort journals"
            fallback="date"
            clearable={false}
            options={[
              { value: "date", label: "Date" },
              { value: "code", label: "Number" },
              { value: "description", label: "Description" },
              { value: "status", label: "Status" },
            ]}
          />
          <FilterSelect
            name="sortDirection"
            label="Sort direction"
            fallback="desc"
            clearable={false}
            options={[
              { value: "desc", label: "Descending" },
              { value: "asc", label: "Ascending" },
            ]}
          />
        </FilterBar>
        {rows.length ? (
          <div className="w-full overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  {[
                    "Number",
                    "Date",
                    "Description",
                    "Type",
                    "Status",
                    "Created by",
                    "Reversal",
                  ].map((x) => (
                    <th className="px-3 py-2 font-medium" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium">
                      <Link
                        className="underline-offset-4 hover:underline"
                        href={`/${org}/accounting/journals/${row.id}`}
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.date}
                    </td>
                    <td className="max-w-80 truncate px-3 py-2.5">
                      {row.description}
                    </td>
                    <td className="px-3 py-2.5">{row.type}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5">{row.creator}</td>
                    <td className="px-3 py-2.5">{row.reversal || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No journal entries yet. Create a manual draft or post approved
            source documents.
          </p>
        )}
        <div className="mt-4">
          <ServerPagination {...data.pagination} />
        </div>
      </FormCard>
    </>
  );
}
