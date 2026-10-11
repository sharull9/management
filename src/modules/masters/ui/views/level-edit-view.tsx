import { notFound } from "next/navigation";
import { UrlTabs } from "@/components/shared/url-tabs";
import { masterData } from "../../server/queries";
import { LevelForm } from "../components/level-forms";
import { LevelValues } from "../components/level-values";
import { MasterFormPage } from "../components/master-pages";

export async function LevelEditView({
  org,
  levelId,
}: {
  org: string;
  levelId: string;
}) {
  const data = await masterData(org);
  const level = data.levels.find((l) => l.id === levelId);
  if (!level) notFound();
  return (
    <MasterFormPage
      backHref={`/${org}/masters/levels`}
      backLabel="All levels"
      title={level.name}
      description={`Level ${level.level}`}
      cardTitle="Level details"
      below={
        <UrlTabs
          tabs={[
            {
              value: "values",
              label: "Values",
              count: level.values.length,
              content: <LevelValues org={org} level={level} />,
            },
          ]}
        />
      }
    >
      <LevelForm org={org} levelNumber={level.level} level={level} />
    </MasterFormPage>
  );
}
