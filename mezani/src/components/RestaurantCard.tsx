import Link from "next/link";
import type { Restaurant } from "@/lib/types";
import { PriceTag } from "./PriceTag";
import { StarRating } from "./StarRating";

export function RestaurantCard({
  restaurant,
  searchQuery,
}: {
  restaurant: Restaurant;
  searchQuery?: string;
}) {
  const href = searchQuery
    ? `/mkahawa/${restaurant.slug}?${searchQuery}`
    : `/mkahawa/${restaurant.slug}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        className={`flex h-36 items-center justify-center bg-gradient-to-br text-5xl ${restaurant.accent}`}
      >
        <span className="drop-shadow-sm">{restaurant.emoji}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-forest-dark group-hover:text-terracotta">
            {restaurant.name}
          </h3>
          <PriceTag priceRange={restaurant.priceRange} />
        </div>
        <p className="text-sm text-foreground/60">
          {restaurant.cuisine} · {restaurant.neighborhood}, {restaurant.city}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <StarRating rating={restaurant.rating} />
          <span className="text-xs text-foreground/50">
            ({restaurant.reviewCount} tathmini)
          </span>
        </div>
      </div>
    </Link>
  );
}
