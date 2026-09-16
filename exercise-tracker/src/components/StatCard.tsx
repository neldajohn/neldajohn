interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: string;
}

export default function StatCard({ label, value, sublabel, icon }: StatCardProps) {
  return (
    <div className="card flex items-center gap-3 p-4">
      {icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-xl">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-gray-400">{label}</p>
        <p className="truncate text-lg font-extrabold text-gray-800 sm:text-xl">{value}</p>
        {sublabel && <p className="truncate text-xs text-gray-400">{sublabel}</p>}
      </div>
    </div>
  );
}
