export function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating);

  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="tracking-tight text-gold">
        {"★".repeat(full)}
        <span className="text-black/15">{"★".repeat(5 - full)}</span>
      </span>
      <span className="font-semibold text-forest-dark">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}
