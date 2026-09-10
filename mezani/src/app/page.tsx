import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { RestaurantCard } from "@/components/RestaurantCard";
import { getFeaturedRestaurants } from "@/lib/restaurants";
import { CITIES } from "@/lib/seed-data";

const CITY_EMOJI: Record<string, string> = {
  "Dar es Salaam": "🌆",
  Arusha: "🏔️",
  Zanzibar: "🏝️",
  Mwanza: "🎣",
  Dodoma: "🏛️",
  Moshi: "☕",
};

export default function Home() {
  const featured = getFeaturedRestaurants(6);

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-forest-dark via-forest to-terracotta-dark px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <span className="rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
            Kwa Watanzania, kila mahali
          </span>
          <h1 className="text-3xl font-bold text-white sm:text-5xl">
            Weka nafasi yako mezani, popote ulipo Tanzania
          </h1>
          <p className="max-w-2xl text-base text-cream/85 sm:text-lg">
            Tafuta na kuweka nafasi katika mikahawa bora zaidi ya Dar es
            Salaam, Arusha, Zanzibar, Mwanza, Dodoma na Moshi — kwa haraka na
            bila malipo.
          </p>

          <div className="mt-2 w-full max-w-3xl">
            <SearchForm variant="hero" />
          </div>
        </div>
      </section>

      <section id="miji" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-xl font-bold text-forest-dark sm:text-2xl">
          Vinjari kwa Jiji
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          Chagua jiji lako upate mikahawa iliyo karibu nawe.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {CITIES.map((city) => (
            <Link
              key={city}
              href={`/mikahawa?jiji=${encodeURIComponent(city)}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <span className="text-3xl">{CITY_EMOJI[city]}</span>
              <span className="text-sm font-semibold text-forest-dark">
                {city}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-forest-dark sm:text-2xl">
              Mikahawa Maarufu
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Vipendwa vya juu kutoka kwa watumiaji wa Mezani.
            </p>
          </div>
          <Link
            href="/mikahawa"
            className="hidden shrink-0 text-sm font-semibold text-terracotta hover:underline sm:block"
          >
            Ona zote →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/mikahawa"
            className="text-sm font-semibold text-terracotta hover:underline"
          >
            Ona mikahawa yote →
          </Link>
        </div>
      </section>

      <section
        id="jinsi-inavyofanya-kazi"
        className="mx-auto max-w-6xl px-4 py-14 sm:px-6"
      >
        <h2 className="text-xl font-bold text-forest-dark sm:text-2xl">
          Jinsi Inavyofanya Kazi
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Tafuta",
              body: "Chagua jiji, tarehe, saa na idadi ya watu kupata mikahawa yenye nafasi.",
              icon: "🔍",
            },
            {
              step: "2",
              title: "Chagua Saa",
              body: "Angalia saa zilizopo na chagua inayokufaa zaidi.",
              icon: "🕒",
            },
            {
              step: "3",
              title: "Thibitisha",
              body: "Jaza jina na namba yako ya simu — nafasi yako inathibitishwa papo hapo.",
              icon: "✅",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
            >
              <span className="text-3xl">{item.icon}</span>
              <h3 className="mt-3 font-semibold text-forest-dark">
                {item.step}. {item.title}
              </h3>
              <p className="mt-1 text-sm text-foreground/60">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
