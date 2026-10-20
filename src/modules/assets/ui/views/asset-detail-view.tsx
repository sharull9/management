import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateSheet, SideSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/core/format";
import type { ListParams } from "@/core/pagination";
import { assetDetail } from "../../server/queries";
import { AllocationForm } from "../components/allocation-form";
import { AssetForm } from "../components/asset-form";
import {
  AssetHistoryTable,
  type HistoryRow,
} from "../components/asset-history-table";
import { DeleteAssetRecord } from "../components/delete-asset-record";
import { FuelForm } from "../components/fuel-form";
import { TripForm } from "../components/trip-form";
import { UsageForm } from "../components/usage-form";

const date = (value: Date) => value.toISOString().slice(0, 10);
const timestamp = (value: Date) =>
  `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;

export async function AssetDetailView({
  org,
  assetId,
  projectId,
  params,
}: {
  org: string;
  assetId: string;
  projectId?: string;
  params?: ListParams;
}) {
  const {
    ctx,
    asset,
    projects,
    canManage,
    canLog: hasOrgLogPermission,
    historyPages,
  } = await assetDetail(org, assetId, projectId, params);
  const projectPermissions = ctx as typeof ctx & {
    isProjectManager?: boolean;
    projectMember?: { role: { permissions: string[] } | null } | null;
  };
  const canLog =
    hasOrgLogPermission ||
    projectPermissions.isProjectManager === true ||
    projectPermissions.projectMember?.role?.permissions.includes(
      "asset.log",
    ) === true;
  const allocationOptions = asset.allocations.map((allocation) => ({
    id: allocation.id,
    projectId: allocation.projectId,
    project: allocation.project,
    startDate: date(allocation.startDate),
    endDate: allocation.endDate ? date(allocation.endDate) : null,
  }));
  const trips: HistoryRow[] = asset.trips.map((item) => ({
    id: item.id,
    date: date(item.outAt),
    project: item.project.name,
    detail: `${timestamp(item.outAt)} to ${timestamp(item.inAt)}${item.electricityCost != null ? ` · ${item.electricityKwh} kWh · electricity ${formatMoney(item.electricityCost, ctx.org.baseCurrency)}` : ""}`,
    reading: `${item.startReading}–${item.endReading}`,
    amount: formatMoney(item.equipmentCost, ctx.org.baseCurrency),
    formKind: "TRIP",
    entry: {
      id: item.id,
      assetId: asset.id,
      allocationId: item.allocationId,
      projectId: item.projectId,
      outAt: item.outAt.toISOString(),
      inAt: item.inAt.toISOString(),
      startReading: item.startReading.toString(),
      endReading: item.endReading.toString(),
      notes: item.notes,
    },
  }));
  const usages: HistoryRow[] = asset.usages.map((item) => ({
    id: item.id,
    date: date(item.startAt),
    project: item.project.name,
    detail: `${timestamp(item.startAt)} to ${timestamp(item.endAt)}${item.electricityCost != null ? ` · ${item.electricityKwh} kWh · electricity ${formatMoney(item.electricityCost, ctx.org.baseCurrency)}` : ""}`,
    reading: `${item.startReading}–${item.endReading} hr`,
    amount: formatMoney(item.equipmentCost, ctx.org.baseCurrency),
    formKind: "USAGE",
    entry: {
      id: item.id,
      assetId: asset.id,
      allocationId: item.allocationId,
      projectId: item.projectId,
      startAt: item.startAt.toISOString(),
      endAt: item.endAt.toISOString(),
      startReading: item.startReading.toString(),
      endReading: item.endReading.toString(),
      notes: item.notes,
    },
  }));
  const historyById = new Map(
    [...trips, ...usages].map((row) => [row.id, row]),
  );
  const electricityRows = [...asset.trips, ...asset.usages].flatMap((item) => {
    const row = historyById.get(item.id);
    return row && item.electricityCost != null
      ? [
          {
            ...row,
            amount: formatMoney(item.electricityCost, ctx.org.baseCurrency),
          },
        ]
      : [];
  });
  const fuels: HistoryRow[] = asset.fuelLogs.map((item) => {
    return {
      id: item.id,
      date: date(item.date),
      project: item.project.name,
      detail: `${item.quantityLitres} L${item.efficiencyEstimate ? ` · ${item.efficiencyEstimate}` : " · estimate unavailable"}`,
      reading: `${item.meterReading} ${asset.meterType === "KM" ? "km" : "hr"}`,
      amount: formatMoney(item.totalCost, ctx.org.baseCurrency),
      formKind: "FUEL",
      entry: {
        id: item.id,
        assetId: asset.id,
        allocationId: item.allocationId,
        projectId: item.projectId,
        date: date(item.date),
        quantityLitres: item.quantityLitres.toString(),
        totalCost: item.totalCost.toString(),
        meterReading: item.meterReading.toString(),
        notes: item.notes,
      },
    };
  });
  const logActions =
    canLog && asset.active && allocationOptions.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {asset.meterType === "KM" ? (
          <CreateSheet label="Record trip">
            <TripForm
              org={org}
              assetId={asset.id}
              allocations={allocationOptions}
              baseCurrency={ctx.org.baseCurrency}
            />
          </CreateSheet>
        ) : (
          <CreateSheet label="Record usage">
            <UsageForm
              org={org}
              assetId={asset.id}
              allocations={allocationOptions}
              baseCurrency={ctx.org.baseCurrency}
            />
          </CreateSheet>
        )}
      </div>
    ) : undefined;
  const fuelAction =
    canLog &&
    asset.active &&
    allocationOptions.length > 0 &&
    (asset.powerType === "DIESEL" || asset.powerType === "PETROL") ? (
      <CreateSheet label="Record fuel">
        <FuelForm
          org={org}
          assetId={asset.id}
          allocations={allocationOptions}
          baseCurrency={ctx.org.baseCurrency}
        />
      </CreateSheet>
    ) : undefined;
  return (
    <div className="space-y-6">
      <PageHeading
        title={asset.name}
        description={`${asset.code} · ${asset.type === "MACHINE" ? "Machine" : "Vehicle"} · ${asset.powerType.toLowerCase()} · ${asset.meterType === "KM" ? "Kilometres" : "Hours"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {projectId && (
              <Button variant="outline" asChild>
                <Link href={`/${org}/projects/${projectId}/assets`}>
                  Back to project assets
                </Link>
              </Button>
            )}
            {canManage && (
              <SideSheet
                title="Edit asset"
                trigger="Edit asset"
                triggerVariant="outline"
              >
                <AssetForm
                  org={org}
                  baseCurrency={ctx.org.baseCurrency}
                  asset={{
                    id: asset.id,
                    type: asset.type,
                    meterType: asset.meterType,
                    powerType: asset.powerType,
                    name: asset.name,
                    code: asset.code,
                    active: asset.active,
                    equipmentRatePerMeter:
                      asset.equipmentRatePerMeter.toString(),
                    powerRatingKw: asset.powerRatingKw?.toString() ?? null,
                    electricityTariff:
                      asset.electricityTariff?.toString() ?? null,
                  }}
                />
              </SideSheet>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={asset.active ? "ACTIVE" : "INACTIVE"} />
        <StatusBadge status={asset.powerType} tone="neutral" />
        <span className="text-sm text-muted-foreground">
          Equipment rate{" "}
          {formatMoney(asset.equipmentRatePerMeter, ctx.org.baseCurrency)} /{" "}
          {asset.meterType === "KM" ? "km" : "hour"}
        </span>
        {asset.powerType === "ELECTRIC" && (
          <span className="text-sm text-muted-foreground">
            {asset.powerRatingKw?.toString()} kW ·{" "}
            {formatMoney(asset.electricityTariff ?? "0", ctx.org.baseCurrency)}{" "}
            / kWh
          </span>
        )}
      </div>
      <section className="space-y-3">
        <SectionHeader
          title="Project allocations"
          description="Inclusive start and end dates determine when logs can be recorded."
          actions={
            canManage ? (
              <CreateSheet label="Allocate asset">
                <AllocationForm
                  org={org}
                  assetId={asset.id}
                  projects={projects}
                />
              </CreateSheet>
            ) : undefined
          }
        />
        {asset.allocations.length ? (
          <div className="space-y-2">
            {asset.allocations.map((allocation) => (
              <Card key={allocation.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <Link
                      className="font-medium hover:underline"
                      href={`/${org}/projects/${allocation.projectId}/assets`}
                    >
                      {allocation.project.name}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        {allocation.project.code}
                      </span>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {date(allocation.startDate)} –{" "}
                      {allocation.endDate
                        ? date(allocation.endDate)
                        : "Ongoing"}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <SideSheet
                        title="Edit allocation"
                        trigger="Edit"
                        triggerVariant="outline"
                        triggerSize="sm"
                      >
                        <AllocationForm
                          org={org}
                          assetId={asset.id}
                          projects={projects}
                          allocation={{
                            id: allocation.id,
                            assetId: asset.id,
                            projectId: allocation.projectId,
                            startDate: date(allocation.startDate),
                            endDate: allocation.endDate
                              ? date(allocation.endDate)
                              : null,
                          }}
                        />
                      </SideSheet>
                      <DeleteAssetRecord
                        org={org}
                        id={allocation.id}
                        kind="ALLOCATION"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No project allocations."
            description="Allocate this asset before recording trips, usage, or fuel."
          />
        )}
      </section>
      <section className="space-y-3">
        <SectionHeader
          title={asset.meterType === "KM" ? "Trip history" : "Usage history"}
          actions={logActions}
        />
        <AssetHistoryTable
          rows={asset.meterType === "KM" ? trips : usages}
          kind={asset.meterType === "KM" ? "Trips" : "Usage"}
          org={org}
          assetId={asset.id}
          allocations={allocationOptions}
          baseCurrency={ctx.org.baseCurrency}
          canEdit={canLog}
          serverPage={
            asset.meterType === "KM" ? historyPages.trips : historyPages.usages
          }
        />
      </section>
      {asset.powerType === "ELECTRIC" && (
        <section className="space-y-3">
          <SectionHeader
            title="Electricity costs"
            description="Shown in the organization base currency."
          />
          <AssetHistoryTable
            rows={electricityRows}
            kind="Electricity"
            org={org}
            assetId={asset.id}
            allocations={allocationOptions}
            baseCurrency={ctx.org.baseCurrency}
            canEdit={canLog}
            serverPage={
              asset.meterType === "KM"
                ? historyPages.trips
                : historyPages.usages
            }
          />
        </section>
      )}
      {(asset.fuelLogs.length > 0 ||
        asset.powerType === "DIESEL" ||
        asset.powerType === "PETROL") && (
        <section className="space-y-3">
          <SectionHeader
            title="Fuel history"
            description="Fuel efficiency is an estimate based on the previous asset fuel reading and the current fill."
            actions={fuelAction}
          />
          <AssetHistoryTable
            rows={fuels}
            kind="Fuel"
            org={org}
            assetId={asset.id}
            allocations={allocationOptions}
            baseCurrency={ctx.org.baseCurrency}
            canEdit={canLog}
            serverPage={historyPages.fuel}
          />
        </section>
      )}
    </div>
  );
}
