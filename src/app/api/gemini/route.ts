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
    
    const prompt = `
คุณคือผู้เชี่ยวชาญด้าน E-commerce Copywriting และการตลาดดิจิทัลบน TikTok Shop, Shopee และ Lazada หน้าที่ของคุณคือเขียน "คำอธิบายรายละเอียดสินค้า (Product Description)" เป็นภาษาไทยให้ออกมาน่าดึงดูด กระตุ้นยอดขาย (Conversion) อ่านง่าย และถูกต้องตามกฎของแพลตฟอร์มปี 2026 อย่างเคร่งครัด
กรุณาเขียนคำอธิบายสินค้าตามข้อมูลดิบของชื่อสินค้าที่กำหนดให้ดังนี้: "${productName}" โดยให้ยึดรูปแบบและข้อกำหนดดังต่อไปนี้อย่างเคร่งครัด

🚨 ข้อกำหนดสำคัญด้านกฎระเบียบ (ห้ามละเมิดเด็ดขาด):
- ห้ามใช้คำโฆษณาเกินจริง (Overclaim) หรือคำที่เสี่ยงผิดนโยบาย เช่น "ดีที่สุด", "รับประกันผลลัพธ์", "รักษาโรค", "ลดโรค", "เห็นผล 100%", "ธรรมชาติ 100%" หรือใช้คำเปรียบเทียบโจมตีแบรนด์อื่น เช่น "vs"
- เขียนเนื้อหาให้ดูเป็นธรรมชาติ สละสลวย ใช้ภาษาพ่อค้าแม่ค้าออนไลน์ที่ดูมืออาชีพ น่าเชื่อถือ และใช้อีโมจิประกอบให้น่าอ่าน แต่อย่าใส่เยอะจนรก
- จัดหน้าเว้นบรรทัดให้โปร่งตา ใช้จุดไข่ปลา (Bullet points) ห้ามเขียนข้อความเรียงติดกันเป็นประโยคยาวๆ เป็นพืด

You MUST return a JSON object matching this exact structure:
{
  "tiktok_title": "ชื่อสินค้าเน้นการทำ SEO ความยาวไม่เกิน 255 ตัวอักษร โดยเรียงโครงสร้างดังนี้: [โปรโมชั่น/แพ็คไซส์] + ชื่อแบรนด์ (ไทยและอังกฤษ) + ชื่อสินค้า (ไทยและอังกฤษ) + สูตร/สี + ขนาด/ปริมาตร เพื่อดักคำค้นหาจากลูกค้าทั้งสองภาษาให้ครอบคลุมที่สุด",
  "description": "คำอธิบายสินค้าภาษาไทยตามรูปแบบด้านล่าง แยกย่อหน้าด้วยเครื่องหมายขึ้นบรรทัดใหม่ (\\n):\n\n🔥 [คำโปรยเปิดหัว Hook สั้น กระชับ ดึงดูดใจ เร้าความสนใจของลูกค้าทันทีใน 3 วินาทีแรก]\n\n📌 **รายละเอียดสินค้า / สูตร / สี**\n- [บอกคุณสมบัติเด่นและเหมาะสำหรับใครให้ชัดเจนแบบ Bullet points]\n- [แทรกรูปภาพอธิบายคุณสมบัติสินค้า/เนื้อสัมผัส ที่นี่] (ใช้ข้อความนี้เป๊ะๆ เป็นไกด์ไลน์บอกจุดลงรูป)\n\n💖 **ทำไมต้องเลือกสินค้านี้?**\n- [สรุปจุดเด่นความคุ้มค่า 4-5 ข้อเป็น Bullet points สั้นๆ กระตุ้นความอยากซื้อ]\n\n💡 **วิธีใช้ และ ข้อมูลสำคัญ**\n- วิธีใช้: [อธิบายวิธีใช้สั้นๆ]\n- ข้อมูลเพิ่มเติม: ขนาด/ปริมาณ และการรับประกันของแท้ 100% (ห้ามเคลมสรรพคุณเกินจริง) พร้อมรับประกันการแพ็คจัดส่งอย่างดี\n\n🎯 **SEO & Keywords**\n[เลือกกลุ่มแฮชแท็ก # ที่เกี่ยวข้องกับสินค้า แบรนด์ และคำค้นหายอดนิยมมา 5-8 แฮชแท็ก]",
  "market_price_analysis": "A brief, professional 2-3 sentence paragraph summarizing estimated online competitor pricing brackets and strategies for this type of product to help the seller set a competitive retail price."
}
`;

    let responseText = "";
    try {
      // 1. Try modern Gemini 2.5 Flash first
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (err25) {
      console.warn("Gemini 2.5 Flash failed, trying 1.5 Flash...", err25);
      try {
        // 2. Fallback to Gemini 1.5 Flash
        const model15 = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await model15.generateContent(prompt);
        responseText = result.response.text();
      } catch (err15) {
        console.warn("Gemini 1.5 Flash failed, trying 1.5 Pro...", err15);
        // 3. Fallback to Gemini 1.5 Pro
        const modelPro = genAI.getGenerativeModel({
          model: "gemini-1.5-pro",
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await modelPro.generateContent(prompt);
        responseText = result.response.text();
      }
    }

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
