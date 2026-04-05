import { Duffel } from "@duffel/api";
import { NextResponse } from "next/server";

// Initialize Duffel with your secret token
const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN || "",
});

export async function POST(req: Request) {
  try {
    const { origin, destination, departureDate } = await req.json();

    // 1. Search for flight offers
    const offerRequest = await duffel.offerRequests.create({
      slices: [
        {
          origin: origin, // e.g., "BOM"
          destination: destination, // e.g., "DEL"
          departure_date: departureDate,
        },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
      return_offers: true,
    });

    // 2. Send the offers back to your frontend
    return NextResponse.json(offerRequest.data.offers);
  } catch (error: any) {
    console.error("Duffel API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}