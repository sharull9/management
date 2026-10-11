import { EmptyState } from "@/components/shared/empty-state";
import { masterData } from "../../server/queries";
import { LevelForm } from "../components/level-forms";
import { MasterFormPage } from "../components/master-pages";

export async function LevelNewView({ org }: { org: string }) {
  const data = await masterData(org);
  const used = new Set(data.levels.map((l) => l.level));
  const next = [1, 2, 3, 4, 5].find((n) => !used.has(n));
  return (
    <MasterFormPage
      backHref={`/${org}/masters/levels`}
      backLabel="All levels"
      title="New level"
      description={next ? `This will be level ${next}.` : "All levels are set."}
      cardTitle="Level details"
    >
      {next ? (
        <LevelForm org={org} levelNumber={next} />
      ) : (
        <EmptyState title="All five levels are already defined." />
      )}
    </MasterFormPage>
  );
}
