import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { productName } = await req.json();

    if (!productName || typeof productName !== "string") {
      return NextResponse.json(
        { error: "Product name is required and must be a string." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured in environment variables." },
        { status: 500 }
      );
    }

    // Initialize Gemini API client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use gemini-1.5-flash as requested
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
You are a expert e-commerce copywriter specializing in TikTok Shop SEO and conversion optimization.
For the product name: "${productName}", generate a structured JSON object containing high-converting TikTok product listing details.

You MUST return a JSON object matching this exact structure:
{
  "tiktok_title": "A catchy, high-SEO-value product title between 25-80 characters containing: [Brand Name placeholder] + [Key ingredient/feature] + [Product Type]",
  "description": "A list of bullet points strictly formatted as: \\n1) Main Ingredients: [details...], \\n2) How to use: [details...], \\n3) Target Demographics: [details...]",
  "market_price_analysis": "A brief, professional 2-3 sentence paragraph summarizing estimated online competitor pricing brackets and strategies for this type of product to help the seller set a competitive retail price."
}

Rules for the content:
- "tiktok_title": Must be extremely catchy, use caps strategically for key selling points, and be optimized for TikTok search queries. Keep it strictly between 25 and 80 characters.
- "description": Use Thai language if the product name contains Thai, or English if it's in English. Provide clear, direct information, highly scannable on mobile screens.
- Avoid using markdown styling inside the JSON string properties.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText) {
      throw new Error("Received empty response from Gemini API.");
    }

    // Parse the response to verify it is valid JSON
    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Gemini API Route Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred while communicating with Gemini." },
      { status: 500 }
    );
  }
}
