import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { BookingForm } from "@/components/BookingForm";

type SearchParams = {
  tarehe?: string;
  saa?: string;
  watu?: string;
};

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString("sw-TZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function WekaNafasiPage({
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

  if (!query.tarehe || !query.saa || !query.watu) {
    redirect(`/mkahawa/${slug}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={`/mkahawa/${slug}`}
        className="text-sm font-medium text-terracotta hover:underline"
      >
        ← Rudi kwa {restaurant.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-forest-dark">
        Kamilisha Nafasi Yako
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm md:col-span-2">
          <div
            className={`flex h-24 items-center justify-center rounded-xl bg-gradient-to-br text-4xl ${restaurant.accent}`}
          >
            {restaurant.emoji}
          </div>
          <h2 className="mt-4 font-semibold text-forest-dark">
            {restaurant.name}
          </h2>
          <p className="text-sm text-foreground/60">
            {restaurant.neighborhood}, {restaurant.city}
          </p>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-b border-black/5 pb-2">
              <dt className="text-foreground/60">Tarehe</dt>
              <dd className="text-right font-semibold text-forest-dark">
                {formatDate(query.tarehe)}
              </dd>
            </div>
            <div className="flex justify-between border-b border-black/5 pb-2">
              <dt className="text-foreground/60">Saa</dt>
              <dd className="font-semibold text-forest-dark">{query.saa}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/60">Idadi ya Watu</dt>
              <dd className="font-semibold text-forest-dark">
                Watu {query.watu}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm md:col-span-3">
          <BookingForm
            slug={slug}
            reservationDate={query.tarehe}
            reservationTime={query.saa}
            partySize={query.watu}
          />
        </div>
      </div>
    </div>
  );
}
