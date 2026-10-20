import Link from "next/link";
import { FormCard } from "@/components/shared/form-card";
import type { TimelineProps } from "../../type";
export function ApprovalTimeline(props: TimelineProps) {
  switch (props.variant) {
    case "procurement":
      return <ProcurementTimeline {...props} />;
    case "bill":
      return <BillTimeline {...props} />;
    case "payment":
      return <PaymentTimeline {...props} />;
    case "sales":
      return <SalesTimeline {...props} />;
  }
}
function ProcurementTimeline({ org, approvals }: TimelineProps) {
  return (
    <FormCard title="Approval timeline">
      <Link
        className="text-sm underline print:hidden"
        href={`/${org}/approvals`}
      >
        Open approvals inbox
      </Link>
      {approvals.map((a) => (
        <div key={a.id} className="mt-4 space-y-2">
          <p className="font-medium">
            {a.status} · {a.createdAt.toLocaleDateString("en-IN")}
          </p>
          <ol className="space-y-2 text-sm">
            {a.steps.map((s) => (
              <li key={s.id}>
                {s.sequence}. {s.name} · {s.status}
                {s.actedBy ? ` · ${s.actedBy.name}` : ""}
                {s.comment ? ` · ${s.comment}` : ""}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!approvals.length && (
        <p className="mt-3 text-sm text-muted-foreground">Not submitted yet.</p>
      )}
    </FormCard>
  );
}
function BillTimeline({ org, approvals }: TimelineProps) {
  const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
  return (
    <FormCard title="Approval timeline">
      <Link className="text-sm underline" href={`/${org}/approvals`}>
        Open approvals inbox
      </Link>
      {approvals.map((a) => (
        <div className="mt-4 space-y-2" key={a.id}>
          <p>
            {a.status} · {day(a.createdAt)}
          </p>
          <ol className="space-y-2 text-sm">
            {a.steps.map((s) => (
              <li key={s.id}>
                {s.sequence}. {s.name} · {s.status}
                {s.actedBy ? ` · ${s.actedBy.name}` : ""}
                {s.comment ? ` · ${s.comment}` : ""}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!approvals.length && (
        <p className="mt-3 text-sm text-muted-foreground">Not submitted yet.</p>
      )}
    </FormCard>
  );
}
function PaymentTimeline({ org, approvals }: TimelineProps) {
  const date = (d: Date) => d.toISOString().slice(0, 10);
  const linkClass = "text-sm font-medium underline underline-offset-4";
  return (
    <FormCard title="Approval timeline">
      <Link className={linkClass} href={`/${org}/approvals`}>
        Open approvals inbox
      </Link>
      {approvals.map((a) => (
        <div key={a.id} className="mt-4 text-sm">
          <p>
            {a.status} · {date(a.createdAt)}
          </p>
          <ol className="mt-2 space-y-2">
            {a.steps.map((s) => (
              <li key={s.id}>
                {s.sequence}. {s.name} · {s.status}
                {s.actedBy ? ` · ${s.actedBy.name}` : ""}
                {s.comment ? ` · ${s.comment}` : ""}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!approvals.length && (
        <p className="mt-3 text-sm text-muted-foreground">Not submitted yet.</p>
      )}
    </FormCard>
  );
}
function SalesTimeline({ approvals }: TimelineProps) {
  return (
    <FormCard title="Approval timeline">
      {approvals.map((a) => (
        <div key={a.id} className="mb-4">
          <p>
            {a.createdAt.toISOString().slice(0, 10)} · {a.status}
          </p>
          {a.steps.map((s) => (
            <p className="text-sm" key={s.id}>
              {s.sequence}. {s.name} · {s.status} ·{" "}
              {s.actedBy?.name ??
                (["PENDING", "WAITING"].includes(s.status)
                  ? "Awaiting action"
                  : "No actor recorded")}{" "}
              {s.comment}
            </p>
          ))}
        </div>
      ))}
      {!approvals.length && <p>Not submitted.</p>}
    </FormCard>
  );
}
