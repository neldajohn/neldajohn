function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Deterministic pseudo-random hash so slot availability stays stable
// for the same restaurant + date across server re-renders.
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export type TimeSlot = {
  time: string;
  available: boolean;
};

export function generateTimeSlots(
  opensAt: string,
  closesAt: string,
  seedKey: string,
): TimeSlot[] {
  const start = timeToMinutes(opensAt);
  let end = timeToMinutes(closesAt);
  if (end <= start) end += 24 * 60;

  const slots: TimeSlot[] = [];
  // Kitchen stops taking new reservations 45 min before closing.
  for (let t = start; t <= end - 45; t += 30) {
    const time = minutesToTime(t);
    const slotHash = hash(`${seedKey}-${time}`);
    slots.push({ time, available: slotHash % 5 !== 0 });
  }
  return slots;
}
