"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "./fields";

type Step = {
  name: string;
  approverType: "ROLE" | "USER" | "PROJECT_MANAGER" | "STAGE_MANAGER";
  roleId: string | null;
  userId: string | null;
  minAmount: string | null;
};
export function PolicyEditor({
  initialSteps,
  roles,
  users,
  projects = [],
  stages = [],
  initialProjectId = null,
  initialStageId = null,
}: {
  initialSteps?: Step[];
  roles: { id: string; name: string }[];
  users: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
  stages?: { id: string; name: string; projectId: string }[];
  initialProjectId?: string | null;
  initialStageId?: string | null;
}) {
  const [scope, setScope] = useState(
    initialStageId ? "stage" : initialProjectId ? "project" : "org",
  );
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [stageId, setStageId] = useState(initialStageId ?? "");
  const [steps, setSteps] = useState<(Step & { editorId: string })[]>(() =>
    (initialSteps?.length
      ? initialSteps
      : [
          {
            name: "Approval",
            approverType: "PROJECT_MANAGER" as const,
            roleId: null,
            userId: null,
            minAmount: null,
          },
        ]
    ).map((s, i) => ({ ...s, editorId: `initial-${i}` })),
  );
  function update(index: number, change: Partial<Step>) {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...change } : s)));
  }
  function move(index: number, delta: number) {
    const result = [...steps];
    [result[index], result[index + delta]] = [
      result[index + delta],
      result[index],
    ];
    setSteps(result);
  }
  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="steps"
        value={JSON.stringify(steps.map(({ editorId: _editorId, ...s }) => s))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Policy scope"
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="org">Organization default</option>
          <option value="project">Project</option>
          <option value="stage">Stage</option>
        </SelectField>
        <SelectField
          label="Project"
          name="projectId"
          disabled={scope === "org"}
          required={scope !== "org"}
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setStageId("");
          }}
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Stage"
          name="stageId"
          disabled={scope !== "stage"}
          required={scope === "stage"}
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
        >
          <option value="">Select stage</option>
          {stages
            .filter((s) => s.projectId === projectId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
      </div>
      {steps.map((step, index) => (
        <fieldset key={step.editorId} className="rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">Step {index + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Step name"
              value={step.name}
              onChange={(e) => update(index, { name: e.target.value })}
              required
            />
            <SelectField
              label="Approver type"
              value={step.approverType}
              onChange={(e) =>
                update(index, {
                  approverType: e.target.value as Step["approverType"],
                  roleId: null,
                  userId: null,
                })
              }
            >
              {["ROLE", "USER", "PROJECT_MANAGER", "STAGE_MANAGER"].map(
                (type) => (
                  <option key={type}>{type}</option>
                ),
              )}
            </SelectField>
            {step.approverType === "ROLE" && (
              <SelectField
                label="Custom role"
                value={step.roleId ?? ""}
                onChange={(e) =>
                  update(index, { roleId: e.target.value || null })
                }
                required
              >
                <option value="">Choose role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
            )}
            {step.approverType === "USER" && (
              <SelectField
                label="Approver"
                value={step.userId ?? ""}
                onChange={(e) =>
                  update(index, { userId: e.target.value || null })
                }
                required
              >
                <option value="">Choose member</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </SelectField>
            )}
            <Field
              label="Minimum amount (optional)"
              inputMode="decimal"
              placeholder="0.00"
              value={step.minAmount ?? ""}
              onChange={(e) =>
                update(index, { minAmount: e.target.value || null })
              }
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Move step ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Move step ${index + 1} down`}
              disabled={index === steps.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={steps.length === 1}
              onClick={() => setSteps(steps.filter((_, i) => i !== index))}
            >
              <Trash2 />
              Remove
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={steps.length >= 20}
        onClick={() =>
          setSteps([
            ...steps,
            {
              editorId: crypto.randomUUID(),
              name: "Approval",
              approverType: "PROJECT_MANAGER",
              roleId: null,
              userId: null,
              minAmount: null,
            },
          ])
        }
      >
        <Plus />
        Add step
      </Button>
      <p className="text-xs text-muted-foreground">
        Manager steps resolve project or stage managers. When no manager is set,
        organization or tenant administrators can act.
      </p>
    </div>
  );
}
