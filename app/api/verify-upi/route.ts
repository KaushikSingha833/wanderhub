import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { upiId } = await request.json();

    if (!upiId) {
      return NextResponse.json({ error: "UPI ID is required" }, { status: 400 });
    }

    // 1. Backend Format Validation
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upiId)) {
      return NextResponse.json({ 
        isValid: false, 
        message: "Invalid UPI format" 
      }, { status: 400 });
    }

    // 2. Simulate Network Latency (mimicking a ping to the NPCI/Bank network)
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // 3. Mock Network Response Logic
    // If they type a specific test failure case, we reject it
    if (upiId === "fail@ybl" || upiId.includes("fake")) {
      return NextResponse.json({
        isValid: false,
        message: "UPI ID not found in banking network."
      });
    }

    // 4. Generate a realistic "Registered Name" based on the UPI ID for the demo
    const namePart = upiId.split('@')[0].replace(/[0-9]/g, '');
    const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const mockFullName = capitalizedName.length > 2 ? `${capitalizedName} Hotels Pvt Ltd` : "WanderHub Partner";

    // 5. Return the successful verification payload
    return NextResponse.json({
      isValid: true,
      registeredName: mockFullName,
      message: "VPA Verified Successfully"
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}