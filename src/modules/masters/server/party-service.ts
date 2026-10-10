import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  id,
  name,
  partyCreditLimitSchema,
  partyEmailSchema,
  partyPaymentTermsSchema,
  partyPhoneSchema,
  partyTypeSchema,
} from "../schema";
import type { MasterKind } from "../type";
import { flag, opt, val } from "./form-data";
import { validateLocation } from "./service";
export async function savePartyMaster(
  tx: Prisma.TransactionClient,
  tenantId: string,
  kind: MasterKind,
  rowId: string | null,
  data: FormData,
) {
  let entityId = rowId ?? "";
  switch (kind) {
    case "party": {
      if (rowId)
        await tx.party.findFirstOrThrow({
          where: { id: rowId, tenantId },
        });
      const fields = {
        code: name.parse(val(data, "code")),
        legalName: name.parse(val(data, "legalName")),
        displayName: name.parse(val(data, "displayName")),
        type: partyTypeSchema.parse(val(data, "type")),
        isVendor: flag(data, "isVendor"),
        isCustomer: flag(data, "isCustomer"),
        email: opt(data, "email")
          ? partyEmailSchema.parse(val(data, "email"))
          : null,
        phone: partyPhoneSchema.parse(opt(data, "phone")),
        paymentTerms: partyPaymentTermsSchema.parse(val(data, "paymentTerms")),
        creditLimit: partyCreditLimitSchema.parse(val(data, "creditLimit")),
      };
      if (!fields.isVendor && !fields.isCustomer)
        throw new Error("Select vendor, customer, or both.");
      entityId = (
        rowId
          ? await tx.party.update({ where: { id: rowId }, data: fields })
          : await tx.party.create({ data: { ...fields, tenantId } })
      ).id;
      break;
    }
    case "address":
    case "contact":
    case "taxIdentifier": {
      const partyId = id.parse(val(data, "partyId"));
      await tx.party.findFirstOrThrow({
        where: { id: partyId, tenantId },
      });
      if (kind === "address") {
        if (rowId)
          await tx.partyAddress.findFirstOrThrow({
            where: { id: rowId, partyId },
          });
        const location = {
          countryId: opt(data, "countryId"),
          stateId: opt(data, "stateId"),
          cityId: opt(data, "cityId"),
        };
        await validateLocation(tx, tenantId, location);
        const fields = {
          partyId,
          ...location,
          label: name.parse(val(data, "label")),
          addressLine1: name.parse(val(data, "addressLine1")),
          addressLine2: opt(data, "addressLine2"),
          postalCode: opt(data, "postalCode"),
          isDefault: flag(data, "isDefault"),
        };
        if (fields.isDefault)
          await tx.partyAddress.updateMany({
            where: { partyId },
            data: { isDefault: false },
          });
        entityId = (
          rowId
            ? await tx.partyAddress.update({
                where: { id: rowId },
                data: fields,
              })
            : await tx.partyAddress.create({ data: fields })
        ).id;
      } else if (kind === "contact") {
        if (rowId)
          await tx.partyContact.findFirstOrThrow({
            where: { id: rowId, partyId },
          });
        const fields = {
          partyId,
          name: name.parse(val(data, "name")),
          email: opt(data, "email")
            ? partyEmailSchema.parse(val(data, "email"))
            : null,
          phone: partyPhoneSchema.parse(opt(data, "phone")),
          jobTitle: opt(data, "jobTitle"),
          isPrimary: flag(data, "isPrimary"),
        };
        if (fields.isPrimary)
          await tx.partyContact.updateMany({
            where: { partyId },
            data: { isPrimary: false },
          });
        entityId = (
          rowId
            ? await tx.partyContact.update({
                where: { id: rowId },
                data: fields,
              })
            : await tx.partyContact.create({ data: fields })
        ).id;
      } else {
        if (rowId)
          await tx.taxIdentifier.findFirstOrThrow({
            where: { id: rowId, partyId },
          });
        const fields = {
          partyId,
          label: name.parse(val(data, "label")),
          value: name.parse(val(data, "value")),
        };
        entityId = (
          rowId
            ? await tx.taxIdentifier.update({
                where: { id: rowId },
                data: fields,
              })
            : await tx.taxIdentifier.create({ data: fields })
        ).id;
      }
      break;
    }
  }
  return entityId;
}
