import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

export type CountryReference = {
  id: string;
  name: string;
  code: string;
  states: { id: string; name: string; code: string }[];
};

/** Read-only global countries and states. */
export function LocationReference({
  countries,
}: {
  countries: CountryReference[];
}) {
  return (
    <FormCard title="Countries and states (read-only)">
      <div className="grid gap-4 sm:grid-cols-2">
        {countries.map((country) => (
          <Item key={country.id} variant="outline">
            <ItemContent>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {country.name} ({country.code}) · {country.states.length}{" "}
                  states
                </summary>
                <ItemGroup className="mt-3">
                  {country.states.map((state) => (
                    <Item key={state.id} variant="outline">
                      <ItemContent>
                        <ItemTitle>
                          {state.name} ({state.code})
                        </ItemTitle>
                      </ItemContent>
                    </Item>
                  ))}
                </ItemGroup>
                {!country.states.length && (
                  <EmptyState title="No states seeded." />
                )}
              </details>
            </ItemContent>
          </Item>
        ))}
      </div>
    </FormCard>
  );
}
