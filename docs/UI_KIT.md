# Shared UI kit

Keep schemas, actions and client components in their module. Generated `src/components/ui` files belong to the shadcn CLI; regenerate rather than edit. Biome overrides cover only the generated Field, Item and InputGroup rules that conflict with upstream markup.

## Forms

Define a Zod v4 object schema in `schema.ts`. The installed zodResolver supports v4. useZodForm validates raw input on the client; typedAction applies transforms once on the server, keeping the action's input type intact. Validate on both sides:

```ts
// server/actions.ts
"use server";
import type { z } from "zod";
import { typedAction } from "@/core/typed-action";
import { profileInput } from "../schema";
export async function saveProfile(input: z.input<typeof profileInput>) {
  return typedAction(profileInput, async (parsed) => {
    // Authenticate, authorize and save parsed data here.
    return undefined; // Refresh; return a URL to redirect instead.
  })(input);
}
```

```tsx
"use client";
import { ActionFormShell, TextField, useZodForm } from "@/components/shared/form";
import { profileInput } from "../../schema";
import { saveProfile } from "../../server/actions";
export function ProfileForm() {
  const form = useZodForm(profileInput, { name: "" });
  return <ActionFormShell form={form} action={saveProfile} submit="Save profile">
    <TextField control={form.control} name="name" label="Name" />
  </ActionFormShell>;
}
```

`useZodForm(schema, defaultValues)` returns RHF's form. `ActionFormShell` takes `form`, `action`, `children`, optional `submit`, `className`, `destructive`. It disables controls during submission, prevents duplicate requests, shows sonner notifications and an inline error, maps `ActionState.fieldErrors` to RHF errors and handles returned `redirectTo` with router.push/refresh. Existing runAction redirects retain Next's control flow. For custom layouts, `useActionSubmit(form, action)` returns `onSubmit`, `pending`, `state`.

`TextField`, `NumberField`, `TextareaField`, `DateField`, `CheckboxField`, `PasswordField` take `control`, typed `name`, `label`, optional `description`. Text, textarea, number and password accept additional input attributes. Date accepts `min`, `max`, `disabled`; checkbox accepts `disabled`. Number values are numbers or `null` when cleared; dates are `YYYY-MM-DD` strings; checkboxes are booleans. Match schema/defaults to these values. `PasswordInput` also works outside RHF with ordinary input props and an accessible show/hide toggle.

Example: `organization-auth/ui/components/sign-in-form.tsx`, rendered by `organization/ui/views/sign-in-view.tsx`. Setup/sign-out still use FormData.

## Comboboxes

Import `Combobox`, `ComboboxField`, type `Option` from `@/components/shared/combobox`. It composes Popover, Command, Button and multi-value Badge.

```tsx
<Combobox options={[{ value: "active", label: "Active" }]} value={status}
  onChange={setStatus} placeholder="Choose status" clearable />
<ComboboxField control={form.control} name="members" label="Members"
  multiple options={memberOptions} searchPlaceholder="Search members…" />
```

Options have `value`, `label`, optional `description`, `disabled`. Single mode uses `string | null`; `multiple` uses `string[]`. Other props are `placeholder`, `searchPlaceholder`, `emptyText`, `disabled`, `clearable`, `loadOptions`, `id`, `ref`, `onBlur` and accessible label/error attributes. ComboboxField adds RHF field props with Controller, label, description and errors. Local filtering includes labels/descriptions through cmdk.

For async search, export a Server Function returning `Option[]`, rather than ActionState:

```ts
// server/picker-actions.ts
"use server";
import { z } from "zod";
export async function findMembers(query: string) {
  const search = z.string().max(150).parse(query);
  // Authenticate, authorize and scope this query to the current tenant.
  const members = await lookupAuthorizedMembers(search);
  return members.map((member) => ({ value: member.id, label: member.name }));
}
```

```tsx
<ComboboxField control={form.control} name="memberId" label="Member"
  options={selectedMember ? [selectedMember] : []} loadOptions={findMembers} clearable />
```

Remote mode debounces 250ms, disables cmdk filtering, displays loading/errors and ignores stale responses. Supply initial selected options so existing IDs have labels before searching. Loaded selected labels persist across queries. Keep loadOptions stable; bind/memoize an org parameter once. Next dispatches Server Functions sequentially; debounce cannot cancel a dispatched request.

## Tables

Import from `@/components/shared/data-table/index`. The legacy `@/components/shared/data-table` file still accepts `headings` and `rows`; it is deprecated.

```tsx
"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table/index";
type Row = { id: string; name: string };
const columns: ColumnDef<Row>[] = [{ accessorKey: "name",
  header: ({ column }) => <DataTableColumnHeader column={column} title="Name" /> }];
export function NamesTable({ data }: { data: Row[] }) {
  return <DataTable columns={columns} data={data} searchPlaceholder="Search names…"
    getRowId={(row) => row.id} rowHref={(row) => `/names/${row.id}`} />;
}
```

Define columns/callbacks in a client file. Server views pass serializable data to that wrapper; never pass column functions across the boundary. Select displayed fields and serialize dates/decimals. Example: `masters/ui/components/cities-table.tsx` and `masters/ui/views/locations-view.tsx`, preserving edit/delete forms.

DataTable takes `columns: ColumnDef<TData>[]`, `data: TData[]`, optional `searchPlaceholder` to enable search, `pageSize` (default 10), `getRowId`, `onRowClick`, `rowHref`, `emptyState`. Sorting/pagination are local. DataTableColumnHeader takes `column`, `title`; DataTablePagination takes `table`. Links use an anchor in the first cell; row clicks also have a keyboard button there and ignore nested interactive controls. Keep the first-cell renderer noninteractive when using rowHref/onRowClick. The table/header/pagination opt out of React Compiler memoization for TanStack v8's mutable instances.

## Empty states and simple lists

`EmptyState({ icon?, title, description?, action? })` composes shadcn Empty. Pass an icon element and a Button/Link action:

```tsx
<EmptyState title="No records found." description="Create your first record." action={<Button>Add record</Button>} />
```

For simple lists, import Item components from `@/components/ui/item`:

```tsx
<ItemGroup>{rows.map((row) => <Item key={row.id} variant="outline">
  <ItemContent><ItemTitle>{row.name}</ItemTitle><ItemDescription>{row.description}</ItemDescription></ItemContent>
  <ItemActions><Button variant="outline">Edit</Button></ItemActions>
</Item>)}</ItemGroup>
```

Use Empty when rows are empty.

## Wave 2 recipe

1. Change non-upload actions from `(previousState, FormData)` to async exported `(input: z.input<typeof schema>)` wrappers calling typedAction. Preserve server authentication, authorization, transactions, refreshes and redirects. Never export the helper's returned function directly from a `"use server"` file; Next requires async function exports.
2. Put forms in client components with useZodForm, explicit defaults and ActionFormShell. Replace Field/SelectField from `shared/fields.tsx` with RHF wrappers and ComboboxField.
3. Replace native select, SelectField, Options and EnumOptions with Combobox. Convert choices to `{ value, label }`, use null for blank single values and arrays for multiple values. Use existing schema/constants for enums; validate choices on the server.
4. Keep FormData actions and legacy ActionForm for uploads. Do not force files through the typed object helper.
5. Move table columns to module client components. Render Empty for "No records" and Item for simple lists.
6. Run tsc, lint, tests, build and boundary checks. Limit edits to assigned modules and coordinate shared changes.
