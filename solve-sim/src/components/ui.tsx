import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-blue-700 hover:bg-blue-50 disabled:text-slate-400',
  danger: 'bg-rose-700 text-white hover:bg-rose-800',
};

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`rounded px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`} />;
}

export function Panel({ title, children, className = '', right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-md border border-slate-200 bg-white ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Modal({ open, title, children, actions }: { open: boolean; title: string; children: ReactNode; actions: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-[440px] rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">{title}</h2>
        <div className="mb-5 text-sm text-slate-600">{children}</div>
        <div className="flex justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'blue' | 'amber' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex gap-1">
      {steps.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={`h-1.5 rounded ${i < current ? 'bg-blue-700' : i === current ? 'bg-blue-400' : 'bg-slate-200'}`} />
          <div className={`mt-1 text-xs ${i === current ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
            {i + 1}. {s}
          </div>
        </li>
      ))}
    </ol>
  );
}
