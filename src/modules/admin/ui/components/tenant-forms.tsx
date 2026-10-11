"use client";
import { Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { PasswordField } from "@/components/shared/form/password-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { createTenantInput } from "../../schema";
import { createTenantAction, tenantStatusAction } from "../../server/actions";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function CreateTenantForm({ onCreated }: { onCreated?: () => void }) {
  const form = useZodForm(createTenantInput, {
    name: "",
    slug: "",
    ownerName: "",
    email: "",
    password: "",
  });
  const name = useWatch({ control: form.control, name: "name" });
  useEffect(() => {
    if (!form.getFieldState("slug").isDirty)
      form.setValue("slug", toSlug(name));
  }, [form, name]);
  return (
    <ActionFormShell
      form={form}
      action={createTenantAction}
      submit="Create tenant"
      onSuccess={() => {
        form.reset();
        onCreated?.();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Tenant name"
          required
        />
        <TextField
          control={form.control}
          name="slug"
          label="Tenant slug"
          description="Filled in from the name. Lowercase letters, numbers and hyphens."
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="ownerName"
          label="Owner name"
          required
        />
        <TextField
          control={form.control}
          name="email"
          label="Owner email"
          type="email"
          required
        />
      </div>
      <PasswordField
        control={form.control}
        name="password"
        label="Temporary password"
        description="Required only when the owner is new to the platform: at least 12 characters. Existing accounts keep their password."
        autoComplete="new-password"
      />
    </ActionFormShell>
  );
}

export function CreateTenantDialog({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus data-icon="inline-start" />
          New tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New tenant</DialogTitle>
          <DialogDescription>
            A tenant is a customer account. Its owner signs in and sets up the
            first organization.
          </DialogDescription>
        </DialogHeader>
        <CreateTenantForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function TenantStatusDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: { id: string; name: string; status: "ACTIVE" | "SUSPENDED" };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const suspending = tenant.status === "ACTIVE";
  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await tenantStatusAction({
          tenantId: tenant.id,
          status: suspending ? "SUSPENDED" : "ACTIVE",
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          suspending
            ? `${tenant.name} is suspended.`
            : `${tenant.name} is active again.`,
        );
        onOpenChange(false);
      } catch {
        toast.error("Unable to update the tenant. Please try again.");
      }
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {suspending
              ? `Suspend ${tenant.name}?`
              : `Reactivate ${tenant.name}?`}
          </DialogTitle>
          <DialogDescription>
            {suspending
              ? "Its members lose access to every organization in this tenant until you reactivate it. No data is deleted."
              : "Its members regain access to their organizations straight away."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={suspending ? "destructive" : "default"}
            disabled={pending}
            onClick={confirm}
          >
            {pending && <Spinner data-icon="inline-start" />}
            {suspending ? "Suspend tenant" : "Reactivate tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
