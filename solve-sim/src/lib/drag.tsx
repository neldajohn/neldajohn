import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';

/** Pointer-based drag and drop: works on HTML and SVG alike, unlike native DnD. */
export type DragItem =
  | { kind: 'fact'; factId: string; value: number; label: string; unit?: string }
  | { kind: 'value'; value: number; label: string; unit?: string; answerId?: string };

interface DragState {
  item: DragItem | null;
  x: number;
  y: number;
  over: string | null;
}

export const useDragStore = create<DragState>(() => ({ item: null, x: 0, y: 0, over: null }));
const handlers = new Map<string, (item: DragItem) => void>();

function targetAt(x: number, y: number): string | null {
  let el = document.elementFromPoint(x, y) as Element | null;
  while (el) {
    const id = el.getAttribute('data-drop-id');
    if (id && handlers.has(id)) return id;
    el = el.parentElement;
  }
  return null;
}

export function beginDrag(e: RPointerEvent, item: DragItem) {
  if (e.button !== 0) return;
  e.preventDefault(); // no text selection while dragging
  const sx = e.clientX;
  const sy = e.clientY;
  let active = false;
  const move = (ev: PointerEvent) => {
    if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    active = true;
    useDragStore.setState({ item, x: ev.clientX, y: ev.clientY, over: targetAt(ev.clientX, ev.clientY) });
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (active) {
      const id = targetAt(ev.clientX, ev.clientY);
      if (id) handlers.get(id)?.(item);
    }
    useDragStore.setState({ item: null, over: null });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

export function useDropTarget(id: string, onDrop: (item: DragItem) => void) {
  const ref = useRef(onDrop);
  ref.current = onDrop;
  useEffect(() => {
    handlers.set(id, (i) => ref.current(i));
    return () => {
      handlers.delete(id);
    };
  }, [id]);
  const over = useDragStore((s) => s.over === id);
  const dragging = useDragStore((s) => s.item !== null);
  return { props: { 'data-drop-id': id }, over, dragging };
}

export function DragLayer() {
  const { item, x, y } = useDragStore();
  if (!item) return null;
  return (
    <div className="pointer-events-none fixed z-50 rounded border border-blue-300 bg-white px-2 py-1 text-xs shadow-lg" style={{ left: x + 12, top: y + 8 }}>
      <span className="font-semibold text-slate-800">{fmtValue(item.value, item.unit)}</span>
      <span className="ml-2 text-slate-500">{item.label}</span>
    </div>
  );
}

export function fmtValue(v: number, unit?: string) {
  const s = Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (!unit) return s;
  if (unit === '%') return `${s}%`;
  if (unit.startsWith('$')) return `$${s}${unit.slice(1)}`;
  return `${s} ${unit}`;
}

/** Brief toast for drop confirmations. */
export function useFlash(ms = 1200): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return [
    msg,
    (m: string) => {
      setMsg(m);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setMsg(null), ms);
    },
  ];
}
