export type LevelConfig = {
  level: number;
  name: string;
  enabled: boolean;
  mode: "NOT_USED" | "ANY" | "LINKED";
  required: boolean;
  values: { id: string; name: string }[];
  linkedIds: string[];
};
export function variantIdentity(
  item: { id: string; name: string },
  configs: LevelConfig[],
  chosen: (string | null)[],
) {
  if (chosen.length > 5) throw new Error("Only five item levels are allowed.");
  const ids = Array.from({ length: 5 }, (_, i) => chosen[i] || null);
  const names = [item.name];
  for (let level = 1; level <= 5; level++) {
    const config = configs.find((c) => c.level === level);
    const selected = ids[level - 1];
    if (!config || !config.enabled || config.mode === "NOT_USED") {
      if (selected) throw new Error(`Level ${level} is not used.`);
      continue;
    }
    if (!selected) {
      if (config.required) throw new Error(`${config.name} is required.`);
      continue;
    }
    const value = config.values.find((v) => v.id === selected);
    if (
      !value ||
      (config.mode === "LINKED" && !config.linkedIds.includes(selected))
    )
      throw new Error(`Invalid ${config.name} value.`);
    names.push(value.name);
  }
  return {
    key: JSON.stringify([item.id, ...ids]),
    name: names.join(" · "),
    ids,
  };
}
