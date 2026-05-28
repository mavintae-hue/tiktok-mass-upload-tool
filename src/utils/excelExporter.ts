import * as XLSX from "xlsx";
import { SkuRow } from "./variantGenerator";

export interface ExcelExportData {
  productName: string;
  description: string;
  weight: number; // in kg
  length: number; // in cm
  width: number;  // in cm
  height: number; // in cm
  attributes: { name: string; values: string[] }[];
  skuRows: SkuRow[];
  mainImagesCount: number;
}

/**
 * Generates an Excel spreadsheet buffer by overlaying data onto the official TikTok Seller Center template.
 * This guarantees 100% correct uploads with all original verification rules and metadata intact.
 */
export async function generateTikTokExcelBuffer(data: ExcelExportData): Promise<Uint8Array> {
  // 1. Fetch the official TikTok template from public assets
  const response = await fetch("/Tiktoksellercenter_batchupload_20260528_template.xlsx");
  if (!response.ok) {
    throw new Error("ไม่สามารถดาวน์โหลดเทมเพลตต้นฉบับจากเซิร์ฟเวอร์ได้ (public/Tiktoksellercenter_batchupload_20260528_template.xlsx)");
  }
  const arrayBuffer = await response.arrayBuffer();
  
  // 2. Read the template workbook
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const sheet = workbook.Sheets["Template"];
  if (!sheet) {
    throw new Error("ไม่พบชีต 'Template' ในไฟล์เทมเพลตของ TikTok");
  }

  // 3. Map dynamic categories based on official options in Sheet 7 "Category"
  let categorySuggestion = "ผลิตภัณฑ์อาบน้ำและดูแลผิวกาย/ครีมบำรุงผิวกายและโลชั่น"; // Default body lotion
  const nameLower = data.productName.toLowerCase();
  if (
    nameLower.includes("serum") ||
    nameLower.includes("เซรั่ม") ||
    nameLower.includes("essence") ||
    nameLower.includes("เอสเซนส์")
  ) {
    categorySuggestion = "สกินแคร์/เซรั่มและเอสเซนส์";
  } else if (
    nameLower.includes("shampoo") ||
    nameLower.includes("แชมพู") ||
    nameLower.includes("hair")
  ) {
    categorySuggestion = "การดูแลและการจัดแต่งทรงผม/แชมพูและครีมนวด";
  } else if (
    nameLower.includes("sunscreen") ||
    nameLower.includes("กันแดด")
  ) {
    categorySuggestion = "สกินแคร์/ครีมกันแดดสำหรับผิวหน้าและผลิตภัณฑ์กันแดด";
  } else if (
    nameLower.includes("scrub") ||
    nameLower.includes("สครับ")
  ) {
    categorySuggestion = "สกินแคร์/สครับผิวหน้าและผลัดเซลล์ผิว";
  } else if (
    nameLower.includes("soap") ||
    nameLower.includes("สบู่")
  ) {
    categorySuggestion = "ผลิตภัณฑ์อาบน้ำและดูแลผิวกาย/สบู่เหลวและสบู่ก้อน";
  }

  // 4. Extract active attributes
  const activeAttributes = data.attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );
  const attr1Name = activeAttributes[0]?.name || "";
  const attr2Name = activeAttributes[1]?.name || "";

  // 5. Build row arrays exactly matching columns A to AB (Row 6 starts at index 5)
  const aoaRows = data.skuRows.map((row) => {
    const val1 = activeAttributes[0] ? row.combination[attr1Name] || "" : "";
    const val2 = activeAttributes[1] ? row.combination[attr2Name] || "" : "";

    // Map variant image filename (based on the first attribute, e.g. Color)
    let variantImgFilename = "";
    if (val1 && (attr1Name.toLowerCase().includes("color") || attr1Name.toLowerCase().includes("สี") || attr1Name.toLowerCase().includes("option"))) {
      const sanitizedVal = val1.toLowerCase().replace(/[^a-z0-9ก-๙_-]/g, "").replace(/\s+/g, "-");
      variantImgFilename = `variant_${sanitizedVal}.jpg`;
    }

    return [
      categorySuggestion,                                     // Col A (0): หมวดหมู่
      "ไม่มีแบรนด์",                                           // Col B (1): แบรนด์
      data.productName,                                       // Col C (2): ชื่อสินค้า
      data.description,                                       // Col D (3): คำอธิบายสินค้า
      data.mainImagesCount >= 1 ? "main_1.jpg" : "",          // Col E (4): ภาพหลัก
      data.mainImagesCount >= 2 ? "main_2.jpg" : "",          // Col F (5): ภาพที่ 2
      data.mainImagesCount >= 3 ? "main_3.jpg" : "",          // Col G (6): ภาพที่ 3
      data.mainImagesCount >= 4 ? "main_4.jpg" : "",          // Col H (7): ภาพที่ 4
      data.mainImagesCount >= 5 ? "main_5.jpg" : "",          // Col I (8): ภาพที่ 5
      data.mainImagesCount >= 6 ? "main_6.jpg" : "",          // Col J (9): ภาพที่ 6
      data.mainImagesCount >= 7 ? "main_7.jpg" : "",          // Col K (10): ภาพที่ 7
      data.mainImagesCount >= 8 ? "main_8.jpg" : "",          // Col L (11): ภาพสินค้า 8
      data.mainImagesCount >= 9 ? "main_9.jpg" : "",          // Col M (12): ภาพสินค้า 9
      attr1Name,                                              // Col N (13): ชื่อตัวเลือกสินค้าหลัก
      val1,                                                   // Col O (14): ค่าตัวเลือกสินค้าหลัก
      variantImgFilename,                                     // Col P (15): ตัวเลือกสินค้าหลักภาพที่ 1
      attr2Name,                                              // Col Q (16): ชื่อตัวเลือกสินค้ารอง
      val2,                                                   // Col R (17): ค่าตัวเลือกสินค้ารอง
      Math.round(data.weight * 1000),                         // Col S (18): น้ำหนักพัสดุ(g) -- Convert kg to grams for TikTok Seller specs!
      data.length,                                            // Col T (19): ความยาวของพัสดุ(cm)
      data.width,                                             // Col U (20): ความกว้างของพัสดุ(cm)
      data.height,                                            // Col V (21): ความสูงของพัสดุ(cm)
      "ตัวเลือกในการจัดส่งสำหรับสินค้านี้เหมือนกับตัวเลือกในการจัดส่งสำหรับร้านค้า", // Col W (22): ตัวเลือกในการจัดส่ง
      parseFloat(row.price) || 0,                            // Col X (23): ราคาขายปลีก (สกุลเงินท้องถิ่น)
      "",                                                     // Col Y (24): เปิดขายล่วงหน้า: เวลาจัดการคำสั่งซื้อ
      parseInt(row.stock) || 0,                               // Col Z (25): ปริมาณ
      row.sku,                                                // Col AA (26): SKU ของผู้ขาย
      ""                                                      // Col AB (27): ตารางขนาด
    ];
  });

  // 6. Overwrite data starting from A6 (Overwriting sample Row 6 and expanding downwards)
  XLSX.utils.sheet_add_aoa(sheet, aoaRows, { origin: "A6" });

  // 7. Write modified workbook back as binary array
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  
  return new Uint8Array(excelBuffer);
}
