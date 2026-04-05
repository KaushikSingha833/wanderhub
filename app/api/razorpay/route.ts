import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();

    const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
    const key_secret = process.env.RAZORPAY_KEY_SECRET || "";

    // Securely encode your keys for Razorpay API
    const auth = btoa(`${key_id}:${key_secret}`);

    // Call Razorpay API to create an Order ID
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amount, // amount in paise
        currency: "INR",
        receipt: "receipt_" + Math.random().toString(36).substring(2, 9),
      }),
    });

    const order = await response.json();
    
    if (order.error) {
       console.error("Razorpay Error:", order.error);
       return NextResponse.json({ error: order.error.description }, { status: 400 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order Creation Failed:", error);
    return NextResponse.json({ error: "Failed to create secure order" }, { status: 500 });
  }
}