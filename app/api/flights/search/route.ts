import { Duffel } from "@duffel/api";
import { NextResponse } from "next/server";

const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN || "",
});

export async function POST(req: Request) {
  try {
    const { origin, destination, departureDate, returnDate, passengers, cabinClass } = await req.json();

    const slices: any[] = [
      {
        origin: origin,
        destination: destination,
        departure_date: departureDate,
      }
    ];

    if (returnDate) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: returnDate,
      });
    }

    const passengerList = Array.from({ length: passengers || 1 }).map(() => ({ type: "adult" }));

    const offerRequest = await duffel.offerRequests.create({
      slices: slices,
      passengers: passengerList,
      cabin_class: cabinClass || "economy",
      return_offers: true,
    } as any);

    // FIXED: Added (offerRequest.data as any) to bypass the final strict type check
    return NextResponse.json((offerRequest.data as any).offers);
  } catch (error: any) {
    console.error("Duffel API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}