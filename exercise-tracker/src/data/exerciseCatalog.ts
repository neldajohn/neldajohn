import rawCatalog from "./exerciseCatalog.json";

export interface CatalogExercise {
  name: string;
  category: string;
}

const CATEGORY_RULES: Array<{ category: string; test: RegExp }> = [
  { category: "Squat & Quads", test: /squat|lunge|leg press|leg extension|step up|hack squat|sit to stand/i },
  { category: "Hinge & Glutes", test: /deadlift|hip thrust|glute|hyperextension|back extension|rdl|romanian/i },
  { category: "Back & Pull", test: /row|pulldown|pull-up|pullup|pull up|chin-up|chin up|shrug|pullover|lat /i },
  { category: "Chest & Push", test: /bench|chest|press-up|press up|fly|pec/i },
  { category: "Shoulders", test: /shoulder|overhead press|military press|lat raise|front raise|lu raise/i },
  { category: "Arms", test: /curl|tricep|bicep|skullcrusher|french press|forearm/i },
  { category: "Core", test: /plank|russian twist|ab curl|sit-up|sit up|v-up|mountain climber|hanging knee/i },
  { category: "Lower Accessories", test: /abductor|adductor|calf/i },
  { category: "Powerlifting Variations", test: /pause|tempo|spotto|block|rack pull|deficit|snatch-grip|larson|feet-up|pin/i },
];

function categorize(name: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(name)) return rule.category;
  }
  return "Other";
}

export const EXERCISE_CATALOG: CatalogExercise[] = (rawCatalog as string[])
  .map((name) => ({ name, category: categorize(name) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const EXERCISE_CATEGORIES: string[] = Array.from(
  new Set(EXERCISE_CATALOG.map((e) => e.category))
).sort();

export function exercisesByCategory(): Record<string, CatalogExercise[]> {
  const grouped: Record<string, CatalogExercise[]> = {};
  for (const ex of EXERCISE_CATALOG) {
    grouped[ex.category] = grouped[ex.category] || [];
    grouped[ex.category].push(ex);
  }
  return grouped;
}
