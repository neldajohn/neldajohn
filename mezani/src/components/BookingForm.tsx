"use client";

import { useActionState } from "react";
import { createReservationAction, type BookingFormState } from "@/app/actions";

const initialState: BookingFormState = {};

export function BookingForm({
  slug,
  reservationDate,
  reservationTime,
  partySize,
}: {
  slug: string;
  reservationDate: string;
  reservationTime: string;
  partySize: string;
}) {
  const [state, formAction, pending] = useActionState(
    createReservationAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="reservationDate" value={reservationDate} />
      <input type="hidden" name="reservationTime" value={reservationTime} />
      <input type="hidden" name="partySize" value={partySize} />

      {state.error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-forest-dark">
          Jina Kamili
        </span>
        <input
          name="fullName"
          type="text"
          required
          placeholder="mfano: Amina Juma"
          className="rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
        />
        {state.fieldErrors?.fullName && (
          <span className="text-xs text-red-600">
            {state.fieldErrors.fullName}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-forest-dark">
          Namba ya Simu
        </span>
        <input
          name="phone"
          type="tel"
          required
          placeholder="mfano: 0712 345 678"
          className="rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
        />
        {state.fieldErrors?.phone && (
          <span className="text-xs text-red-600">
            {state.fieldErrors.phone}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-forest-dark">
          Barua Pepe <span className="font-normal text-foreground/50">(hiari)</span>
        </span>
        <input
          name="email"
          type="email"
          placeholder="mfano: amina@mfano.co.tz"
          className="rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
        />
        {state.fieldErrors?.email && (
          <span className="text-xs text-red-600">
            {state.fieldErrors.email}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-forest-dark">
          Maombi Maalum{" "}
          <span className="font-normal text-foreground/50">(hiari)</span>
        </span>
        <textarea
          name="specialRequest"
          rows={3}
          placeholder="mfano: Tunasherehekea siku ya kuzaliwa"
          className="rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-terracotta px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Inathibitisha..." : "Thibitisha Nafasi"}
      </button>
    </form>
  );
}
