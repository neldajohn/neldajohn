"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/weeks", label: "Weeks", icon: "🗓️" },
  { href: "/exercises", label: "Progress", icon: "📈" },
  { href: "/log", label: "Log Workout", icon: "✏️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-pink-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-pink-600 text-lg shadow-sm">
            💪
          </span>
          <div className="leading-tight">
            <p className="text-sm font-extrabold tracking-tight text-pink-700">Nelda&apos;s Program</p>
            <p className="text-[11px] font-medium text-gray-400">Strength Tracker</p>
          </div>
        </Link>

        <nav className="flex flex-1 justify-end gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-pink-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-pink-50 hover:text-pink-700"
                }`}
              >
                <span aria-hidden>{link.icon}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
