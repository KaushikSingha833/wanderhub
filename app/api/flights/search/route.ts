import { Duffel } from "@duffel/api";
import { NextResponse } from "next/server";

const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN || "",
});

export async function POST(req: Request) {
  try {
    // Extract all the advanced data from your new frontend
    const { origin, destination, departureDate, returnDate, passengers, cabinClass } = await req.json();

    // 1. Build the flight slices (Handles both One-Way and Round-Trip!)
    const slices: any[] = [
      {
        origin: origin,
        destination: destination,
        departure_date: departureDate,
      }
    ];

    // If the user selected round trip, automatically add the return flight
    if (returnDate) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: returnDate,
      });
    }

    // 2. Generate the correct number of passengers
    const passengerList = Array.from({ length: passengers || 1 }).map(() => ({ type: "adult" }));

    // 3. Search for flight offers
    // We use "as any" here to bypass Vercel's strict TypeScript compiler for the Duffel SDK
    const offerRequest = await duffel.offerRequests.create({
      slices: slices,
      passengers: passengerList,
      cabin_class: cabinClass || "economy",
      return_offers: true,
    } as any);

    return NextResponse.json(offerRequest.data.offers);
  } catch (error: any) {
    console.error("Duffel API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}