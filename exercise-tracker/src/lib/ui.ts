export function rpeBadgeClass(rpeStr: string | null | undefined): string {
  const rpe = rpeStr ? Number(rpeStr) : null;
  if (rpe === null || Number.isNaN(rpe)) return "bg-gray-100 text-gray-500";
  if (rpe >= 9.5) return "bg-rose-100 text-rose-700";
  if (rpe >= 8) return "bg-pink-100 text-pink-700";
  if (rpe >= 6) return "bg-fuchsia-50 text-fuchsia-600";
  return "bg-gray-100 text-gray-500";
}

export function dayTypeBadgeClass(dayType: string): string {
  const t = dayType.toLowerCase();
  if (t.includes("upper")) return "bg-pink-100 text-pink-700";
  if (t.includes("lower")) return "bg-rose-100 text-rose-700";
  if (t.includes("cardio")) return "bg-fuchsia-100 text-fuchsia-700";
  if (t.includes("bench") || t.includes("squat") || t.includes("dead")) return "bg-pink-200 text-pink-800";
  return "bg-gray-100 text-gray-600";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
