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
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
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

Example: `organization-auth/ui/components/sign-in-form.tsx`, rendered by `organization/ui/views/sign-in-view.tsx`. Sign-out still uses FormData.

## Comboboxes

Import `Combobox` and type `Option` from `@/components/shared/combobox/combobox`, and `ComboboxField` from `@/components/shared/combobox/combobox-field`. It composes Popover, Command, Button and multi-value Badge.

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

## Domain pickers

Import client fields directly from their defining files under `@/components/shared/form/`. All take RHF `control` and typed `name`, and support transformed form output generics. Set defaults in the form. All implementations live in concrete files. Shared indexes are forbidden; no compatibility re-exports remain. Import `ItemVariantField` from `form/item-variant-field`, `CostTypeField` from `form/cost-type-field`, and `MaterialCostRecognitionField` from `form/material-cost-recognition-field`, all under `@/components/shared/`.

### Item and variant

`ItemVariantField` takes `items: PickerItem[]`, optional `loadItems(query): Promise<PickerItem[]>`, `label` (default "Item"), `description`, and `disabled`. `name` points to an `ItemVariantValue` object, including inside a field array. Each item has the legacy `id`, `name`, and `configs: LevelConfig[]`; its optional UOM/tax metadata is also accepted. Types can be imported on the server from `form/item-variant-value`.

The value is `{ itemId: string | null, level1: string | null, level2: string | null, level3: string | null, level4: string | null, level5: string | null }`. These are the legacy submitted field names grouped into one object; there is no separate variant ID. Empty levels are `null`. Changing items clears all levels; returning to the initial item restores its initial levels, as in the legacy picker. Disabled and `NOT_USED` configs are hidden, `ANY` lists all values, and `LINKED` lists only `linkedIds`. Required item/levels are checked by RHF when no resolver is supplied; with a resolver, the module schema must validate this object and the required/allowed levels on client and server. Nested schema errors are included in the picker error summary. `variantIdentity` consumes levels in numeric order to derive a variant key/name.

```tsx
// defaultValues.selection = { itemId: null, level1: null, level2: null,
//   level3: null, level4: null, level5: null }
<ItemVariantField control={form.control} name="selection" items={items} />
```

For async search, return complete items with configs from an authenticated, tenant-scoped Server Function. Pass existing selected items in `items` so labels/configs are available before searching. Keep `loadItems` stable. The shared Combobox handles debounce, loading, errors and stale option responses; the picker retains loaded item configs across searches.

### Cost type

`CostTypeField` takes `control`, `name`, optional `label` (default "Cost type"), `description`, and single Combobox props such as `disabled`, `placeholder`, `clearable`. Its fixed choices are LABOUR, MATERIAL, EQUIPMENT, FUEL, ELECTRICITY, SUBCONTRACT, OVERHEAD, OTHER, with human labels. The value is an enum string, or `null` when blank.

```tsx
<CostTypeField control={form.control} name="costType" />
```

### Material cost recognition

`MaterialCostRecognitionField` takes `control`, `name`, optional `label`, `description`, `disabled`, and `existingProject`. The mode field is `"ON_RECEIPT" | "ON_CONSUMPTION"`; default it to `"ON_CONSUMPTION"` in the form. With `existingProject: true`, `confirmationName` is required and identifies a separate boolean field, defaulted to `false`. This displays the legacy warning and acknowledgement. The module schema/action decides when confirmation is required based on stock history; the picker does not force it for every existing project.

```tsx
<MaterialCostRecognitionField control={form.control} name="materialCostRecognition"
  existingProject confirmationName="confirmCostRecognitionChange" />
```

### Option helpers

Import `toOptions` and `enumOptions` directly from `@/components/shared/form/enum-options`. This pure file has no client directive and can run in server views. `toOptions(rows)` maps `{ id, name }` to `{ value: id, label: name }`. `enumOptions(values: Record<string, string>)` keeps enum values, replaces underscores with spaces and title-cases each word. The helpers use human labels and return `Option[]` in input order and omit a blank option; single Combobox fields represent blank values with `null`.

```ts
const itemOptions = toOptions([{ id: "steel", name: "Steel" }]);
const modeOptions = enumOptions({ ON_RECEIPT: "ON_RECEIPT" });
// [{ value: "ON_RECEIPT", label: "On Receipt" }]
```

### Single and multiple choices

Use `ComboboxField` from `@/components/shared/combobox/combobox-field`.
Single values are `string | null`; `multiple` stores `string[]`. Defaults and
validation belong to the form/schema. The old select aliases have been removed.

```tsx
<ComboboxField control={form.control} name="vendorId" label="Vendor" options={vendors} clearable />
<ComboboxField control={form.control} name="memberIds" label="Members" options={members} multiple />
```

## Tables

Import `DataTable` from `@/components/shared/data-table/data-table`, `DataTableColumnHeader` from `@/components/shared/data-table/data-table-column-header`, and `DataTablePagination` from `@/components/shared/data-table/data-table-pagination`. The legacy headings/rows component has been removed.

```tsx
"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
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

## Migration recipe

1. Change non-upload actions from `(previousState, FormData)` to async exported `(input: z.input<typeof schema>)` wrappers calling typedAction. Preserve server authentication, authorization, transactions, refreshes and redirects. Never export the helper's returned function directly from a `"use server"` file; Next requires async function exports.
2. Put forms in client components with useZodForm, explicit defaults and ActionFormShell. Use RHF field wrappers and ComboboxField.
3. Use Combobox for single and multiple choices. Convert choices to `{ value, label }`, use null for blank single values and arrays for multiple values. Use existing schema/constants for enums; validate choices on the server.
4. Keep FormData actions and legacy ActionForm for uploads. Do not force files through the typed object helper.
5. Move table columns to module client components. Render Empty for "No records" and Item for simple lists.
6. Run tsc, lint, tests, build and boundary checks. Respect module boundaries.

Import `dateValue` from `@/components/shared/form/date-value`. Filters use Combobox fields and `router.replace` with search parameters, preserving unrelated query values and deleting cleared filters. Upload and sign-out forms may retain `ActionForm` with shadcn Field primitives.

The retained `ActionForm` import is `@/components/shared/action-form`. Sign-out ignores its FormData payload; upload actions validate metadata with Zod and files with explicit size/type checks or a file schema. Vendor bill and task upload components can retain RHF for metadata and send files in FormData.
