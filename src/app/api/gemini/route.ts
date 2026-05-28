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
  "description": "คำอธิบายสินค้าภาษาไทยแบบละเอียด เจาะลึก และครบถ้วนสมบูรณ์ที่สุด (ความยาวอย่างน้อย 800-1500 คำ) แยกย่อหน้าด้วยเครื่องหมายขึ้นบรรทัดใหม่ (\\n) โดยแบ่งโครงสร้างหัวข้อย่อยและเนื้อหาเจาะลึกดังนี้:\n\n🔥 **[ชื่อสินค้าและคำโปรยหัว Hook ที่ทรงพลัง]**\n[คำโปรยเร้าอารมณ์กระตุ้นความรู้สึกเจ็บปวดหรือความต้องการของลูกค้า ดึงดูดใจทันทีใน 3 วินาทีแรก ยาว 2-3 บรรทัด]\n\n📌 **รายละเอียดสินค้าเชิงลึก & คุณสมบัติเด่น (Product Deep Dive)**\n- [อธิบายคุณสมบัติเด่นและการทำงานของแต่ละฟังก์ชัน/ส่วนผสมสำคัญอย่างเจาะลึกและละเอียดที่สุด พร้อมแจกแจงประโยชน์ที่ลูกค้าจะได้รับจริงแบบเห็นภาพชัดเจน]\n- [บอกประเภทผิว/ความเหมาะสมในการใช้งาน และช่วงโอกาสที่ควรใช้งานอย่างครบถ้วน]\n- [บอกเทคโนโลยีหรือความพิเศษเฉพาะตัวที่ทำให้สินค้านี้แตกต่างจากคู่แข่งทั่วไปในท้องตลาด]\n\n💎 **ส่วนประกอบสำคัญ / วัสดุ / เทคโนโลยีการผลิต (Key Ingredients & Materials)**\n- [ลิสต์ส่วนผสมหรือวัสดุหลัก 3-5 รายการ พร้อมระบุสรรพคุณและคุณประโยชน์เชิงลึกของแต่ละตัวอย่างละเอียดว่าช่วยแก้ปัญหาหรือพัฒนาชีวิตของลูกค้าอย่างไร]\n\n💖 **ทำไมต้องเลือกสินค้านี้? (7 จุดเด่นพิชิตใจลูกค้า)**\n- [ลิสต์ข้อดี ความโดดเด่น และความคุ้มค่าของผลิตภัณฑ์อย่างน้อย 6-7 ข้อเป็น Bullet points เพื่อปิดการขายทันที]\n\n💡 **วิธีใช้งานอย่างมืออาชีพเพื่อให้ได้ผลลัพธ์สูงสุด (Step-by-Step Usage Guide)**\n- ขั้นตอนที่ 1: [เตรียมตัว/ทำความสะอาด/ตั้งค่าเริ่มต้นอย่างละเอียด]\n- ขั้นตอนที่ 2: [วิธีการใช้งานอย่างถูกต้องในชีวิตประจำวันอย่างละเอียด]\n- ขั้นตอนที่ 3: [เคล็ดลับ/Tip พิเศษเพื่อให้ได้ผลลัพธ์ที่ดีขึ้นเป็นสองเท่า]\n- ข้อควรระวังและวิธีการเก็บรักษา: [ข้อมูลความปลอดภัยและการยืดอายุการใช้งาน]\n\n📦 **สิ่งที่ลูกค้าจะได้รับในกล่อง & ข้อมูลการจัดส่ง (Package & Delivery Info)**\n- [แจกแจงอุปกรณ์หรือส่วนประกอบภายในกล่องทั้งหมดอย่างละเอียดแบบแยกชิ้น]\n- ขนาดบรรจุ/ขนาดสินค้า: [ข้อมูลทางเทคนิคของมิติและน้ำหนัก]\n- การรับประกัน: มั่นใจสินค้าแท้ 100% ส่งตรงจากแบรนด์ มีระบบตรวจสอบย้อนหลัง พร้อมรับประกันการแพ็คแน่นหนากันกระแทก 3 ชั้น และส่งด่วนทุกวัน\n\n💬 **คำถามที่พบบ่อย (FAQs)**\n- Q: [คำถามสำคัญอันดับ 1 เช่น ใช้กี่วันเห็นผล หรือ วิธีดูแลความสะอาด]?\n  A: [คำตอบที่สร้างความมั่นใจ คลายข้อกังวลของลูกค้าอย่างชัดเจน]\n- Q: [คำถามสำคัญอันดับ 2 เช่น เหมาะกับผิวแพ้ง่าย/เด็กหรือไม่]?\n  A: [คำตอบที่สุภาพ ปลอดภัย และตรงไปตรงมา]\n\n🎯 **SEO Hashtags**\n[เลือกกลุ่มแฮชแท็ก # ที่กำลังเป็นกระแส 8-10 แฮชแท็กที่ครอบคลุมชื่อสินค้า แบรนด์ ปัญหาของลูกค้า และคำค้นหายอดนิยมบน TikTok]",
  "market_price_analysis": "A brief, professional 2-3 sentence paragraph summarizing estimated online competitor pricing brackets and strategies for this type of product to help the seller set a competitive retail price."
}
`;

    let responseText = "";
    const errors: string[] = [];

    // รายชื่อโมเดลฟรีที่ได้รับการรองรับในระบบ Google AI Studio เพื่อความเสถียร 100%
    const modelsToTry = [
      "gemini-2.0-flash",       // โมเดลล่าสุดของปี 2025/2026 ทำงานเร็วมาก โควตาฟรีสูง
      "gemini-1.5-flash",       // โมเดลมาตรฐานที่นิยมใช้ที่สุด
      "gemini-1.5-flash-8b",    // โมเดลน้ำหนักเบา 8B มีความเสถียรและทนทานต่อการจำกัดโควตา (Rate Limits)
      "gemini-2.5-flash",       // โมเดลทดสอบประสิทธิภาพสูง
      "gemini-1.5-pro"          // โมเดลประมวลผลซับซ้อน (เป็นตัวเลือกสุดท้ายกรณีโมเดลอื่นขัดข้อง)
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`[INFO] Trying Gemini model: ${modelName}...`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        
        if (responseText) {
          console.log(`[SUCCESS] Generated listing content using model: ${modelName}`);
          break; // หยุดวนลูปทันทีเมื่อโมเดลตัวใดตัวหนึ่งตอบกลับข้อมูลสำเร็จ
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${modelName} Error: ${errMsg}`);
        console.warn(`[WARNING] Gemini model ${modelName} failed. Falling back... Error:`, errMsg);
      }
    }

    if (!responseText) {
      throw new Error(`ไม่สามารถใช้บริการ Gemini API ได้ในขณะนี้เนื่องจาก:\n${errors.join("\n")}`);
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
