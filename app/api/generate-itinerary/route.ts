import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the SDK with your secret key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    // Read the user's prompt from the frontend
    const { prompt, startDate } = await req.json();

    // Use the fast Flash model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 🚨 THE SYSTEM PROMPT: This forces the AI to act like an API
    const systemPrompt = `
      You are an expert travel planner. The user wants to go to: "${prompt}".
      Generate a realistic 3-day itinerary starting on this date: ${startDate}.
      
      You MUST respond ONLY with a raw, valid JSON array of objects. Do not use markdown blocks, and do not add any conversational text.
      Each object must perfectly match this TypeScript interface:
      {
        "title": "Name of the place or flight",
        "type": "flight" | "hotel" | "food" | "activity",
        "date": "YYYY-MM-DD",
        "time": "HH:MM AM/PM",
        "location": "Street address or City",
        "notes": "A short, fun description of what to do here"
      }
    `;

    // Ping the AI
    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();

    // Clean the response (just in case the AI added markdown formatting)
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Convert the text into a real JavaScript array
    const itinerary = JSON.parse(cleanJson);

    // Send it back to your frontend
    return NextResponse.json({ activities: itinerary });

  } catch (error) {
    console.error("AI Generation Error:", error);
    return NextResponse.json(
      { error: 'Failed to generate itinerary. Please try again.' }, 
      { status: 500 }
    );
  }
}