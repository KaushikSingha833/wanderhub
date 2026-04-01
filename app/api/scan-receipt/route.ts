import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Get the image file from the frontend
    const formData = await req.formData();
    const file = formData.get("file") as Blob;
    
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 2. Convert the image into a Base64 string that Gemini can read
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    // 3. Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 4. Strict prompt to force Gemini to return ONLY clean JSON
    const prompt = `Analyze this receipt image. 
    Extract the merchant, store, or restaurant name as 'title'. 
    Extract the final total amount paid as a number for 'amount'. 
    If money is in other currencies, convert it to INR using the latest exchange rates.
    Return ONLY a valid JSON object in this exact format, without any markdown formatting or extra text: 
    {"title": "Merchant Name", "amount": 12.34}`;

    // 5. Send image and prompt to Gemini
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: file.type,
        },
      },
    ]);

    // 6. Clean up the response and parse it
    const responseText = result.response.text();
    // Sometimes Gemini adds ```json to the string, so we strip it out just in case
    const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanJsonString);

    return NextResponse.json(extractedData);

  } catch (error) {
    console.error("OCR Scanner Error:", error);
    return NextResponse.json({ error: "Failed to read receipt" }, { status: 500 });
  }
}