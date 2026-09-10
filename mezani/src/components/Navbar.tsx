import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-terracotta text-lg text-white">
            🍽️
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-xl font-bold tracking-tight text-forest-dark">
              Mezani
            </span>
            <span className="text-[11px] font-medium text-forest/70">
              Weka nafasi yako mezani
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-foreground/80 sm:flex">
          <Link href="/" className="transition hover:text-terracotta">
            Nyumbani
          </Link>
          <Link href="/mikahawa" className="transition hover:text-terracotta">
            Mikahawa
          </Link>
          <Link href="/#miji" className="transition hover:text-terracotta">
            Miji
          </Link>
        </nav>

        <Link
          href="/mikahawa"
          className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta-dark"
        >
          Tafuta Mkahawa
        </Link>
      </div>
    </header>
  );
}
