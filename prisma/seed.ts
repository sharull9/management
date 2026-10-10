import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const countries = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  SG: "Singapore",
  AU: "Australia",
  CA: "Canada",
  DE: "Germany",
};
const states: Record<string, Record<string, string>> = {
  IN: {
    AP: "Andhra Pradesh",
    AR: "Arunachal Pradesh",
    AS: "Assam",
    BR: "Bihar",
    CG: "Chhattisgarh",
    GA: "Goa",
    GJ: "Gujarat",
    HR: "Haryana",
    HP: "Himachal Pradesh",
    JH: "Jharkhand",
    KA: "Karnataka",
    KL: "Kerala",
    MP: "Madhya Pradesh",
    MH: "Maharashtra",
    MN: "Manipur",
    ML: "Meghalaya",
    MZ: "Mizoram",
    NL: "Nagaland",
    OD: "Odisha",
    PB: "Punjab",
    RJ: "Rajasthan",
    SK: "Sikkim",
    TN: "Tamil Nadu",
    TS: "Telangana",
    TR: "Tripura",
    UP: "Uttar Pradesh",
    UK: "Uttarakhand",
    WB: "West Bengal",
    AN: "Andaman and Nicobar Islands",
    CH: "Chandigarh",
    DN: "Dadra and Nagar Haveli and Daman and Diu",
    DL: "Delhi",
    JK: "Jammu and Kashmir",
    LA: "Ladakh",
    LD: "Lakshadweep",
    PY: "Puducherry",
  },
  US: {
    CA: "California",
    NY: "New York",
    TX: "Texas",
    FL: "Florida",
    WA: "Washington",
  },
  AE: {
    AZ: "Abu Dhabi",
    DU: "Dubai",
    SH: "Sharjah",
    AJ: "Ajman",
    FU: "Fujairah",
    RK: "Ras Al Khaimah",
    UQ: "Umm Al Quwain",
  },
};
const units: Record<string, [string, string, string][]> = {
  Count: [
    ["Nos", "Number", "1"],
    ["Dozen", "Dozen", "12"],
    ["Box", "Box", "1"],
  ],
  Weight: [
    ["kg", "Kilogram", "1"],
    ["g", "Gram", "0.001"],
    ["tonne", "Tonne", "1000"],
    ["quintal", "Quintal", "100"],
  ],
  Volume: [
    ["L", "Litre", "1"],
    ["mL", "Millilitre", "0.001"],
    ["kL", "Kilolitre", "1000"],
  ],
  Length: [
    ["m", "Metre", "1"],
    ["cm", "Centimetre", "0.01"],
    ["mm", "Millimetre", "0.001"],
    ["km", "Kilometre", "1000"],
    ["ft", "Foot", "0.3048"],
  ],
  Area: [
    ["sqm", "Square metre", "1"],
    ["sqft", "Square foot", "0.0929"],
  ],
  Time: [
    ["hour", "Hour", "1"],
    ["day", "Day", "24"],
  ],
};

async function main() {
  for (const [code, name] of Object.entries(countries)) {
    const country = await db.country.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    });
    for (const [stateCode, stateName] of Object.entries(states[code] ?? {})) {
      await db.state.upsert({
        where: { countryId_code: { countryId: country.id, code: stateCode } },
        create: { countryId: country.id, code: stateCode, name: stateName },
        update: { name: stateName },
      });
    }
  }
  for (const [name, values] of Object.entries(units)) {
    const group = await db.uomGroup.upsert({
      where: { key: `system:${name.toLowerCase()}` },
      create: { key: `system:${name.toLowerCase()}`, name },
      update: { name },
    });
    for (const [index, [code, unitName, factor]] of values.entries()) {
      await db.uom.upsert({
        where: { groupId_code: { groupId: group.id, code } },
        create: {
          groupId: group.id,
          code,
          name: unitName,
          factor,
          isBase: index === 0,
        },
        update: { name: unitName, factor, isBase: index === 0 },
      });
    }
  }
  console.log("Seeded countries, states and system units.");
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
