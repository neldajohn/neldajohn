"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getRestaurantBySlug } from "@/lib/restaurants";
import { createReservation } from "@/lib/reservations";

const reservationSchema = z.object({
  slug: z.string().min(1),
  fullName: z.string().trim().min(2, "Tafadhali jaza jina lako kamili"),
  phone: z
    .string()
    .trim()
    .min(9, "Tafadhali jaza namba sahihi ya simu"),
  email: z
    .union([z.literal(""), z.string().trim().email("Barua pepe si sahihi")])
    .optional(),
  partySize: z.coerce.number().int().min(1).max(20),
  reservationDate: z.string().min(1, "Chagua tarehe"),
  reservationTime: z.string().min(1, "Chagua saa"),
  specialRequest: z.string().trim().max(500).optional(),
});

export type BookingFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createReservationAction(
  _prevState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = reservationSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Tafadhali sahihisha taarifa hapa chini.", fieldErrors };
  }

  const restaurant = getRestaurantBySlug(parsed.data.slug);
  if (!restaurant) {
    return { error: "Mkahawa huu haukupatikana." };
  }

  const reservation = createReservation({
    restaurantId: restaurant.id,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    partySize: parsed.data.partySize,
    reservationDate: parsed.data.reservationDate,
    reservationTime: parsed.data.reservationTime,
    specialRequest: parsed.data.specialRequest || null,
  });

  redirect(`/uthibitisho/${reservation.code}`);
}
