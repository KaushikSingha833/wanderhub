import { NextResponse } from "next/server";

export async function GET(req: Request) {
  // 1. Get the city name from the URL (e.g., /api/weather?city=Pune)
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  if (!city) {
    return NextResponse.json({ error: "City is required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.WEATHER_API_KEY;
    
    // 2. Fetch the 5-day forecast (in Celsius)
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${apiKey}`
    );
    const data = await res.json();

    if (data.cod !== "200") {
      return NextResponse.json({ error: data.message }, { status: Number(data.cod) });
    }

    // 3. OpenWeather returns data every 3 hours (40 items). 
    // We filter it to only grab the weather at Noon (12:00 PM) each day for a clean 5-day list.
    const dailyForecast = data.list.filter((reading: any) => 
      reading.dt_txt.includes("12:00:00")
    );

    return NextResponse.json(dailyForecast);

  } catch (error) {
    console.error("Weather Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 });
  }
}