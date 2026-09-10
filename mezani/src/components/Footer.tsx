import Link from "next/link";
import { CITIES } from "@/lib/seed-data";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-black/5 bg-forest-dark text-cream/90">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta text-base">
              🍽️
            </span>
            <span className="text-lg font-bold text-white">Mezani</span>
          </div>
          <p className="mt-3 text-sm text-cream/70">
            Jukwaa la kuweka nafasi za mezani katika mikahawa bora zaidi
            Tanzania.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Miji</h3>
          <ul className="mt-3 space-y-2 text-sm text-cream/70">
            {CITIES.map((city) => (
              <li key={city}>
                <Link
                  href={`/mikahawa?jiji=${encodeURIComponent(city)}`}
                  className="transition hover:text-gold"
                >
                  {city}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Mezani</h3>
          <ul className="mt-3 space-y-2 text-sm text-cream/70">
            <li>
              <Link href="/mikahawa" className="transition hover:text-gold">
                Tafuta Mikahawa
              </Link>
            </li>
            <li>
              <Link href="/#jinsi-inavyofanya-kazi" className="transition hover:text-gold">
                Jinsi Inavyofanya Kazi
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Mawasiliano</h3>
          <ul className="mt-3 space-y-2 text-sm text-cream/70">
            <li>Barua pepe: msaada@mezani.co.tz</li>
            <li>Simu: +255 700 000 000</li>
            <li>Dar es Salaam, Tanzania</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-cream/60 sm:px-6">
        © {new Date().getFullYear()} Mezani. Imetengenezwa kwa mapenzi kwa
        ajili ya Watanzania.
      </div>
    </footer>
  );
}
