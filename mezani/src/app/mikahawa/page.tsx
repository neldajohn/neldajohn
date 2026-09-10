import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { RestaurantCard } from "@/components/RestaurantCard";
import { listRestaurants } from "@/lib/restaurants";
import { CUISINES } from "@/lib/seed-data";

type SearchParams = {
  jiji?: string;
  tarehe?: string;
  saa?: string;
  watu?: string;
  aina?: string;
};

export default async function MikahawaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const restaurants = listRestaurants({
    city: params.jiji,
    cuisine: params.aina,
  });

  const bookingQuery = new URLSearchParams();
  if (params.tarehe) bookingQuery.set("tarehe", params.tarehe);
  if (params.saa) bookingQuery.set("saa", params.saa);
  if (params.watu) bookingQuery.set("watu", params.watu);

  function cuisineHref(cuisine?: string) {
    const q = new URLSearchParams();
    if (params.jiji) q.set("jiji", params.jiji);
    if (params.tarehe) q.set("tarehe", params.tarehe);
    if (params.saa) q.set("saa", params.saa);
    if (params.watu) q.set("watu", params.watu);
    if (cuisine) q.set("aina", cuisine);
    const qs = q.toString();
    return qs ? `/mikahawa?${qs}` : "/mikahawa";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-forest-dark">
        {params.jiji ? `Mikahawa ${params.jiji}` : "Mikahawa Yote"}
      </h1>
      <p className="mt-1 text-sm text-foreground/60">
        {restaurants.length} mikahawa imepatikana
        {params.tarehe ? ` kwa tarehe ${params.tarehe}` : ""}
        {params.saa ? ` saa ${params.saa}` : ""}.
      </p>

      <div className="mt-6">
        <SearchForm
          variant="compact"
          initialCity={params.jiji ?? ""}
          initialDate={params.tarehe ?? ""}
          initialTime={params.saa ?? ""}
          initialPartySize={params.watu ?? "2"}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={cuisineHref(undefined)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            !params.aina
              ? "bg-terracotta text-white"
              : "bg-sand text-forest-dark hover:bg-sand/70"
          }`}
        >
          Aina Zote
        </Link>
        {CUISINES.map((cuisine) => (
          <Link
            key={cuisine}
            href={cuisineHref(cuisine)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              params.aina === cuisine
                ? "bg-terracotta text-white"
                : "bg-sand text-forest-dark hover:bg-sand/70"
            }`}
          >
            {cuisine}
          </Link>
        ))}
      </div>

      {restaurants.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">🍽️</span>
          <p className="font-semibold text-forest-dark">
            Hatujapata mkahawa unaolingana na utafutaji wako
          </p>
          <p className="text-sm text-foreground/60">
            Jaribu kubadilisha jiji au aina ya chakula.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              searchQuery={bookingQuery.toString() || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
