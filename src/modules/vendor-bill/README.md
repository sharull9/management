# Vendor bill forms

The draft form uses React Hook Form and `useFieldArray` with `billFormInput`.
It sends every bill field and line as JSON in a FormData `payload` entry and
sends the optional `attachment` File separately. `billFormData` builds this
envelope; `billUploadInput` decodes it and validates it through `typedAction`.
Dates stay as strings on the client and transform once on the server.
The form alone normalizes an empty due date to null; `billInput` and the
`saveBill` service signature remain compatible with the phase3b smoke scripts.

This keeps the typed form and file in one submission. Storage is written first,
then the bill and attachment metadata are saved in the same transaction. A failed
transaction deletes the stored file. The existing attachment-only form remains
available for adding more copies to a draft. Both forms validate PDF, PNG or JPEG
files up to 900,000 bytes on the client and server.

`saveBill` retains its service signature and checks tenant ownership, receipt
reservations, variance calculations and tax snapshots. Approval submission keeps
its transaction, locking and receipt validation. Picker actions authenticate,
scope searches to the organization and tenant, and check bill project access.
