const LABELS: Record<number, string> = {
  1: "Bei nafuu",
  2: "Wastani",
  3: "Ghali kidogo",
};

export function PriceTag({ priceRange }: { priceRange: number }) {
  return (
    <span
      title={LABELS[priceRange] ?? ""}
      className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-forest-dark"
    >
      {"$".repeat(priceRange)}
    </span>
  );
}
