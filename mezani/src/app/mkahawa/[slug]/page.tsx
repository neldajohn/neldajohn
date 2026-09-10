import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { StarRating } from "@/components/StarRating";
import { PriceTag } from "@/components/PriceTag";
import { BookingWidget } from "@/components/BookingWidget";

type SearchParams = {
  tarehe?: string;
  saa?: string;
  watu?: string;
};

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const restaurant = getRestaurantBySlug(slug);

  if (!restaurant) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div
        className={`flex h-48 items-center justify-center rounded-2xl bg-gradient-to-br text-7xl sm:h-64 ${restaurant.accent}`}
      >
        {restaurant.emoji}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-forest-dark sm:text-3xl">
                {restaurant.name}
              </h1>
              <p className="mt-1 text-sm text-foreground/60">
                {restaurant.cuisine} · {restaurant.neighborhood},{" "}
                {restaurant.city}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StarRating rating={restaurant.rating} />
              <PriceTag priceRange={restaurant.priceRange} />
            </div>
          </div>

          <p className="mt-5 leading-relaxed text-foreground/80">
            {restaurant.description}
          </p>

          <div className="mt-8">
            <h2 className="font-semibold text-forest-dark">
              Menyu Maarufu
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {restaurant.popularDishes.map((dish) => (
                <li
                  key={dish}
                  className="flex items-center gap-2 rounded-lg bg-sand/60 px-3 py-2 text-sm text-forest-dark"
                >
                  <span>🍴</span>
                  {dish}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-black/5 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Saa za Kufunguliwa
              </h3>
              <p className="mt-1 text-sm text-forest-dark">
                Kila siku: {restaurant.opensAt} – {restaurant.closesAt}
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Anwani
              </h3>
              <p className="mt-1 text-sm text-forest-dark">
                {restaurant.address}
              </p>
            </div>
            <div className="rounded-xl border border-black/5 bg-white p-4 sm:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Simu
              </h3>
              <p className="mt-1 text-sm text-forest-dark">
                {restaurant.phone}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingWidget
            slug={restaurant.slug}
            opensAt={restaurant.opensAt}
            closesAt={restaurant.closesAt}
            initialDate={query.tarehe}
            initialTime={query.saa}
            initialPartySize={query.watu}
          />
        </div>
      </div>
    </div>
  );
}
