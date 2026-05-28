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
  brand?: string; // Excel Brand name
}

// Fallback sheet headers matching the TikTok Seller Center Batch Upload Template V5
const TEMPLATE_HEADERS = [
  "หมวดหมู่",
  "แบรนด์",
  "ชื่อสินค้า",
  "คำอธิบายสินค้า",
  "ภาพหลัก",
  "ภาพที่ 2",
  "ภาพที่ 3",
  "ภาพที่ 4",
  "ภาพที่ 5",
  "ภาพที่ 6",
  "ภาพที่ 7",
  "ภาพสินค้า 8",
  "ภาพสินค้า 9",
  "ชื่อตัวเลือกสินค้าหลัก (ธีม)",
  "ค่าตัวเลือกสินค้าหลัก (ตัวเลือก)",
  "ตัวเลือกสินค้าหลักภาพที่ 1",
  "ชื่อตัวเลือกสินค้ารอง (ธีม)",
  "ค่าตัวเลือกสินค้ารอง (ตัวเลือก)",
  "น้ำหนักพัสดุ(g)",
  "ความยาวของพัสดุ(cm)",
  "ความกว้างของพัสดุ(cm)",
  "ความสูงของพัสดุ(cm)",
  "ตัวเลือกในการจัดส่ง",
  "ราคาขายปลีก (สกุลเงินท้องถิ่น)",
  "เปิดขายล่วงหน้า: เวลาจัดการคำสั่งซื้อ",
  "ปริมาณ",
  "SKU ของผู้ขาย",
  "ตารางขนาด"
];

const MANDATORY_ROW = [
  "บังคับ", "ไม่บังคับ", "บังคับ", "บังคับ",
  "บังคับ", "ไม่บังคับ", "ไม่บังคับ", "ไม่บังคับ", "ไม่บังคับ", "ไม่บังคับ", "ไม่บังคับ", "ไม่บังคับ", "ไม่บังคับ",
  "บังคับตามเงื่อนไข", "บังคับตามเงื่อนไข", "ไม่บังคับ",
  "บังคับตามเงื่อนไข", "ไม่บังคับ",
  "บังคับ", "บังคับตามเงื่อนไข", "บังคับตามเงื่อนไข", "บังคับตามเงื่อนไข", "ไม่บังคับ",
  "บังคับ", "ไม่บังคับ", "บังคับ", "ไม่บังคับ", "บังคับตามเงื่อนไข"
];

const EXPLANATION_ROW = [
  "เลือกหมวดหมู่ที่ตรงกับสินค้าจากรายการดร็อปดาวน์",
  "เลือกแบรนด์ที่ตรงกับสินค้าจากเมนูดรอปดาวน์",
  "ชื่อสินค้าต้องมีน้อยกว่า 255 ตัวอักษร",
  "ให้คำอธิบายสินค้าโดยละเอียด เช่น ข้อมูลจำเพาะของสินค้า วัสดุ สิ่งที่อยู่ในกล่อง และอื่น ๆ",
  "เพิ่ม URL ของรูปภาพหลักของสินค้า",
  "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม", "เพิ่ม URL ของรูปภาพเพิ่มเติม",
  "ป้อนชื่อตัวเลือกสินค้าหลัก เช่น สี",
  "ป้อนค่าตัวเลือกหลัก เช่น สีขาว",
  "เพิ่ม URL รูปภาพสำหรับตัวเลือกสินค้าหลัก",
  "ป้อนชื่อตัวเลือกสินค้ารอง เช่น ขนาด",
  "ป้อนค่าตัวเลือกหลักรอง เช่น S",
  "น้ำหนักของพัสดุรวมกล่องบรรจุภัณฑ์ (กรัม)",
  "ความยาวของกล่องพัสดุ (เซนติเมตร)",
  "ความกว้างของกล่องพัสดุ (เซนติเมตร)",
  "ความสูงของกล่องพัสดุ (เซนติเมตร)",
  "ตัวเลือกในการจัดส่งสำหรับสินค้านี้เหมือนกับตัวเลือกในการจัดส่งสำหรับร้านค้า",
  "กรอกราคาสินค้าหรือตัวแปรของสินค้า",
  "เว้นว่างช่องนี้",
  "ปริมาณสต็อกของสินค้า",
  "SKU ของผู้ขาย",
  "URL ตารางขนาดสินค้า"
];

/**
 * Pure client-side generation that loads the original official template file and overwrites it.
 */
export async function generateTikTokExcelBuffer(data: ExcelExportData): Promise<Uint8Array> {
  let arrayBuffer: ArrayBuffer;
  
  try {
    // Fetch the raw official template dynamically from the public directory
    const response = await fetch("/Tiktoksellercenter_batchupload_20260528_template.xlsx");
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel template: ${response.statusText}`);
    }
    arrayBuffer = await response.arrayBuffer();
  } catch (err) {
    console.warn("[WARNING] Cannot load official template from public folder. Generating styled fallback...", err);
    return generateFallbackExcelBuffer(data);
  }

  try {
    // Load the workbook
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const ws = workbook.Sheets['Template'];
    if (!ws) {
      throw new Error("Sheet 'Template' not found inside official template file.");
    }

    // 1. Purge all existing data from Row 3 (A4) downwards
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let r = 3; r <= range.e.r; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        delete ws[cellRef];
      }
    }
    range.e.r = 2; // Reset range end to row 2

    // 2. Determine Category Name in Thai according to TikTok Shop tree
    const categoryName = getSuggestedCategory(data.productName);

    // 3. Extract active attributes
    const activeAttributes = data.attributes.filter(
      (attr) => attr.name.trim() !== "" && attr.values.length > 0
    );
    const attr1Name = activeAttributes[0]?.name || "";
    const attr2Name = activeAttributes[1]?.name || "";

    const brandName = data.brand || "ไม่มีแบรนด์";
    const weightInGrams = Math.round(data.weight * 1000) || 250; // Convert kg to grams!

    // 4. Build product data rows
    const sheetRowsAOA: any[][] = [];

    data.skuRows.forEach((row) => {
      const val1 = activeAttributes[0] ? row.combination[attr1Name] || "" : "";
      const val2 = activeAttributes[1] ? row.combination[attr2Name] || "" : "";

      // Map variant image filename (based on color attribute value)
      let variantImgFilename = "";
      if (val1 && (attr1Name.toLowerCase().includes("color") || attr1Name.toLowerCase().includes("สี") || attr1Name.toLowerCase().includes("option"))) {
        const sanitizedVal = val1.toLowerCase().replace(/[^a-z0-9ก-๙_-]/g, "").replace(/\s+/g, "-");
        variantImgFilename = `product_images/variant_${sanitizedVal}.jpg`;
      }

      // Map images relative paths
      const mainImg = data.mainImagesCount >= 1 ? "product_images/main_1.jpg" : "";
      const img2 = data.mainImagesCount >= 2 ? "product_images/main_2.jpg" : "";
      const img3 = data.mainImagesCount >= 3 ? "product_images/main_3.jpg" : "";
      const img4 = data.mainImagesCount >= 4 ? "product_images/main_4.jpg" : "";
      const img5 = data.mainImagesCount >= 5 ? "product_images/main_5.jpg" : "";
      const img6 = data.mainImagesCount >= 6 ? "product_images/main_6.jpg" : "";
      const img7 = data.mainImagesCount >= 7 ? "product_images/main_7.jpg" : "";
      const img8 = data.mainImagesCount >= 8 ? "product_images/main_8.jpg" : "";
      const img9 = data.mainImagesCount >= 9 ? "product_images/main_9.jpg" : "";

      const rowAOA = [
        categoryName, // Col 0: หมวดหมู่
        brandName,    // Col 1: แบรนด์
        data.productName, // Col 2: ชื่อสินค้า
        data.description, // Col 3: คำอธิบายสินค้า
        mainImg,      // Col 4: ภาพหลัก
        img2,         // Col 5: ภาพที่ 2
        img3,         // Col 6: ภาพที่ 3
        img4,         // Col 7: ภาพที่ 4
        img5,         // Col 8: ภาพที่ 5
        img6,         // Col 9: ภาพที่ 6
        img7,         // Col 10: ภาพที่ 7
        img8,         // Col 11: ภาพสินค้า 8
        img9,         // Col 12: ภาพสินค้า 9
        attr1Name,    // Col 13: ชื่อตัวเลือกสินค้าหลัก (ธีม)
        val1,         // Col 14: ค่าตัวเลือกสินค้าหลัก (ตัวเลือก)
        variantImgFilename, // Col 15: ตัวเลือกสินค้าหลักภาพที่ 1
        attr2Name,    // Col 16: ชื่อตัวเลือกสินค้ารอง (ธีม)
        val2,         // Col 17: ค่าตัวเลือกสินค้ารอง (ตัวเลือก)
        weightInGrams, // Col 18: น้ำหนักพัสดุ(g)
        data.length,  // Col 19: ความยาวของพัสดุ(cm)
        data.width,   // Col 20: ความกว้างของพัสดุ(cm)
        data.height,  // Col 21: ความสูงของพัสดุ(cm)
        "ตัวเลือกในการจัดส่งสำหรับสินค้านี้เหมือนกับตัวเลือกในการจัดส่งสำหรับร้านค้า", // Col 22: ตัวเลือกในการจัดส่ง
        parseFloat(row.price) || 0, // Col 23: ราคาขายปลีก (สกุลเงินท้องถิ่น)
        "",           // Col 24: เปิดขายล่วงหน้า: เวลาจัดการคำสั่งซื้อ
        parseInt(row.stock) || 0, // Col 25: ปริมาณ
        row.sku,      // Col 26: SKU ของผู้ขาย
        ""            // Col 27: ตารางขนาด
      ];

      sheetRowsAOA.push(rowAOA);
    });

    // Write starting at A4
    XLSX.utils.sheet_add_aoa(ws, sheetRowsAOA, { origin: "A4" });

    // Expand ref range boundary
    range.e.r = 3 + sheetRowsAOA.length - 1;
    ws['!ref'] = XLSX.utils.encode_range(range);

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return new Uint8Array(excelBuffer);
  } catch (parseErr) {
    console.error("[ERROR] Failed to modify official template in memory, using fallback generator.", parseErr);
    return generateFallbackExcelBuffer(data);
  }
}

/**
 * Fallback Excel file builder that compiles the exact same column structures from scratch
 */
function generateFallbackExcelBuffer(data: ExcelExportData): Uint8Array {
  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, MANDATORY_ROW, EXPLANATION_ROW]);
  XLSX.utils.book_append_sheet(workbook, ws, "Template");

  const categoryName = getSuggestedCategory(data.productName);
  const brandName = data.brand || "ไม่มีแบรนด์";
  const weightInGrams = Math.round(data.weight * 1000) || 250;

  const activeAttributes = data.attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );
  const attr1Name = activeAttributes[0]?.name || "";
  const attr2Name = activeAttributes[1]?.name || "";

  const sheetRowsAOA: any[][] = [];

  data.skuRows.forEach((row) => {
    const val1 = activeAttributes[0] ? row.combination[attr1Name] || "" : "";
    const val2 = activeAttributes[1] ? row.combination[attr2Name] || "" : "";

    let variantImgFilename = "";
    if (val1 && (attr1Name.toLowerCase().includes("color") || attr1Name.toLowerCase().includes("สี") || attr1Name.toLowerCase().includes("option"))) {
      const sanitizedVal = val1.toLowerCase().replace(/[^a-z0-9ก-๙_-]/g, "").replace(/\s+/g, "-");
      variantImgFilename = `product_images/variant_${sanitizedVal}.jpg`;
    }

    const mainImg = data.mainImagesCount >= 1 ? "product_images/main_1.jpg" : "";
    const img2 = data.mainImagesCount >= 2 ? "product_images/main_2.jpg" : "";
    const img3 = data.mainImagesCount >= 3 ? "product_images/main_3.jpg" : "";
    const img4 = data.mainImagesCount >= 4 ? "product_images/main_4.jpg" : "";
    const img5 = data.mainImagesCount >= 5 ? "product_images/main_5.jpg" : "";
    const img6 = data.mainImagesCount >= 6 ? "product_images/main_6.jpg" : "";
    const img7 = data.mainImagesCount >= 7 ? "product_images/main_7.jpg" : "";
    const img8 = data.mainImagesCount >= 8 ? "product_images/main_8.jpg" : "";
    const img9 = data.mainImagesCount >= 9 ? "product_images/main_9.jpg" : "";

    const rowAOA = [
      categoryName,
      brandName,
      data.productName,
      data.description,
      mainImg,
      img2,
      img3,
      img4,
      img5,
      img6,
      img7,
      img8,
      img9,
      attr1Name,
      val1,
      variantImgFilename,
      attr2Name,
      val2,
      weightInGrams,
      data.length,
      data.width,
      data.height,
      "ตัวเลือกในการจัดส่งสำหรับสินค้านี้เหมือนกับตัวเลือกในการจัดส่งสำหรับร้านค้า",
      parseFloat(row.price) || 0,
      "",
      parseInt(row.stock) || 0,
      row.sku,
      ""
    ];

    sheetRowsAOA.push(rowAOA);
  });

  XLSX.utils.sheet_add_aoa(ws, sheetRowsAOA, { origin: "A4" });

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  range.e.r = 3 + sheetRowsAOA.length - 1;
  ws['!ref'] = XLSX.utils.encode_range(range);

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Uint8Array(excelBuffer);
}

/**
 * Heuristics to return the suggested TikTok Shop Thailand category
 */
function getSuggestedCategory(productName: string): string {
  const nameLower = productName.toLowerCase();
  
  if (
    nameLower.includes("serum") ||
    nameLower.includes("cream") ||
    nameLower.includes("skin") ||
    nameLower.includes("เซรั่ม") ||
    nameLower.includes("ครีม") ||
    nameLower.includes("บำรุงผิว") ||
    nameLower.includes("โลชั่น") ||
    nameLower.includes("lotion") ||
    nameLower.includes("ซิตร้า") ||
    nameLower.includes("citra")
  ) {
    return "ความงามและของใช้ส่วนตัว/ผลิตภัณฑ์ดูแลผิวหน้า/เซรั่มและเอสเซนส์";
  } else if (
    nameLower.includes("shampoo") ||
    nameLower.includes("hair") ||
    nameLower.includes("แชมพู") ||
    nameLower.includes("ยาสระผม") ||
    nameLower.includes("ครีมนวด")
  ) {
    return "ความงามและของใช้ส่วนตัว/การดูแลและจัดแต่งทรงผม/แชมพูและครีมนวดผม";
  } else if (
    nameLower.includes("food") ||
    nameLower.includes("supplement") ||
    nameLower.includes("วิตามิน") ||
    nameLower.includes("อาหารเสริม") ||
    nameLower.includes("คนอร์") ||
    nameLower.includes("knorr") ||
    nameLower.includes("โจ๊ก") ||
    nameLower.includes("ซุปก้อน")
  ) {
    return "อาหารและเครื่องดื่ม/อาหารแห้ง/ซุปและอาหารปรุงสำเร็จ";
  } else if (
    nameLower.includes("ซักผ้า") ||
    nameLower.includes("ปรับผ้านุ่ม") ||
    nameLower.includes("ผงซักฟอก") ||
    nameLower.includes("detergent") ||
    nameLower.includes("บรีส") ||
    nameLower.includes("โอโม") ||
    nameLower.includes("คอมฟอร์ท") ||
    nameLower.includes("breeze") ||
    nameLower.includes("omo") ||
    nameLower.includes("comfort")
  ) {
    return "ของใช้ในบ้าน/ผลิตภัณฑ์ซักรีดและดูแลผ้า/น้ำยาซักผ้าและผงซักฟอก";
  } else if (
    nameLower.includes("จาน") ||
    nameLower.includes("ซันไลต์") ||
    nameLower.includes("dishwash") ||
    nameLower.includes("sunlight")
  ) {
    return "ของใช้ในบ้าน/ผลิตภัณฑ์ซักรีดและดูแลผ้า/น้ำยาล้างจาน";
  }

  // General default category
  return "ความงามและของใช้ส่วนตัว/ผลิตภัณฑ์อาบน้ำและดูแลผิวกาย/ผลิตภัณฑ์ทำความสะอาดผิวกาย";
}
