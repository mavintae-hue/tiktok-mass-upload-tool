import ExcelJS from "exceljs";
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
 * Uses ExcelJS which guarantees full style, validation dropdown, and workbook integrity without corruption.
 */
export async function generateTikTokExcelBuffer(data: ExcelExportData): Promise<Uint8Array> {
  let workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet;

  // 1. Map dynamic categories based on official options in Sheet 7 "Category"
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

  // 2. Extract active attributes
  const activeAttributes = data.attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );
  const attr1Name = activeAttributes[0]?.name || "";
  const attr2Name = activeAttributes[1]?.name || "";

  try {
    // Try to fetch the official TikTok template from public assets in the browser
    const response = await fetch("/Tiktoksellercenter_batchupload_20260528_template.xlsx");
    if (!response.ok) {
      throw new Error(`Template returned status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    
    // Load existing workbook via arrayBuffer (retains all styles, dropdowns, hidden sheets!)
    await workbook.xlsx.load(arrayBuffer);
    const templateSheet = workbook.getWorksheet("Template");
    if (!templateSheet) {
      throw new Error("ไม่พบชีต 'Template' ในไฟล์ต้นแบบ");
    }
    sheet = templateSheet;
    console.log("[EXCELJS] Loaded official TikTok template workbook.");
  } catch (err) {
    console.warn("[EXCELJS] Failed to load official template. Generating dynamic fallback...", err);
    
    // Build a brand-new workbook and sheet as fallback
    workbook = new ExcelJS.Workbook();
    const fallbackSheet = workbook.addWorksheet("Template");
    
    const headers = [
      "หมวดหมู่", "แบรนด์", "ชื่อสินค้า", "คำอธิบายสินค้า",
      "ภาพหลัก", "ภาพที่ 2", "ภาพที่ 3", "ภาพที่ 4", "ภาพที่ 5", "ภาพที่ 6", "ภาพที่ 7", "ภาพสินค้า 8", "ภาพสินค้า 9",
      "ชื่อตัวเลือกสินค้าหลัก (ธีม)", "ค่าตัวเลือกสินค้าหลัก (ตัวเลือก)", "ตัวเลือกสินค้าหลักภาพที่ 1",
      "ชื่อตัวเลือกสินค้ารอง (ธีม)", "ค่าตัวเลือกสินค้ารอง (ตัวเลือก)",
      "น้ำหนักพัสดุ(g)", "ความยาวของพัสดุ(cm)", "ความกว้างของพัสดุ(cm)", "ความสูงของพัสดุ(cm)",
      "ตัวเลือกในการจัดส่ง", "ราคาขายปลีก (สกุลเงินท้องถิ่น)", "เปิดขายล่วงหน้า: เวลาจัดการคำสั่งซื้อ", "ปริมาณ", "SKU ของผู้ขาย", "ตารางขนาด"
    ];

    fallbackSheet.addRow(headers); // Row 1
    fallbackSheet.addRow(headers.map((h, i) => i === 1 || i >= 23 && i !== 25 ? "ไม่บังคับ" : "บังคับ")); // Row 2
    fallbackSheet.addRow(headers.map(() => "รายละเอียดคุณลักษณะสินค้าสำหรับ TikTok Seller Center")); // Row 3
    fallbackSheet.addRow([]); // Row 4
    fallbackSheet.addRow([]); // Row 5
    
    sheet = fallbackSheet;
  }

  // 3. Write our variant data starting from Row 6 (index 6 in ExcelJS)
  data.skuRows.forEach((row, rowIndex) => {
    const targetRowNumber = 6 + rowIndex;
    const xlsxRow = sheet.getRow(targetRowNumber);

    const val1 = activeAttributes[0] ? row.combination[attr1Name] || "" : "";
    const val2 = activeAttributes[1] ? row.combination[attr2Name] || "" : "";

    // Map variant image filename (based on the first attribute, e.g. Color)
    let variantImgFilename = "";
    if (val1 && (attr1Name.toLowerCase().includes("color") || attr1Name.toLowerCase().includes("สี") || attr1Name.toLowerCase().includes("option"))) {
      const sanitizedVal = val1.toLowerCase().replace(/[^a-z0-9ก-๙_-]/g, "").replace(/\s+/g, "-");
      variantImgFilename = `variant_${sanitizedVal}.jpg`;
    }

    // Populate cell values (1-indexed for columns: A=1, B=2, C=3...)
    xlsxRow.getCell(1).value = categorySuggestion;                                     // A: หมวดหมู่
    xlsxRow.getCell(2).value = "ไม่มีแบรนด์";                                           // B: แบรนด์
    xlsxRow.getCell(3).value = data.productName;                                       // C: ชื่อสินค้า
    xlsxRow.getCell(4).value = data.description;                                       // D: คำอธิบายสินค้า
    xlsxRow.getCell(5).value = data.mainImagesCount >= 1 ? "main_1.jpg" : "";          // E: ภาพหลัก
    xlsxRow.getCell(6).value = data.mainImagesCount >= 2 ? "main_2.jpg" : "";          // F: ภาพที่ 2
    xlsxRow.getCell(7).value = data.mainImagesCount >= 3 ? "main_3.jpg" : "";          // G: ภาพที่ 3
    xlsxRow.getCell(8).value = data.mainImagesCount >= 4 ? "main_4.jpg" : "";          // H: ภาพที่ 4
    xlsxRow.getCell(9).value = data.mainImagesCount >= 5 ? "main_5.jpg" : "";          // I: ภาพที่ 5
    xlsxRow.getCell(10).value = data.mainImagesCount >= 6 ? "main_6.jpg" : "";         // J: ภาพที่ 6
    xlsxRow.getCell(11).value = data.mainImagesCount >= 7 ? "main_7.jpg" : "";         // K: ภาพที่ 7
    xlsxRow.getCell(12).value = data.mainImagesCount >= 8 ? "main_8.jpg" : "";         // L: ภาพสินค้า 8
    xlsxRow.getCell(13).value = data.mainImagesCount >= 9 ? "main_9.jpg" : "";         // M: ภาพสินค้า 9
    xlsxRow.getCell(14).value = attr1Name;                                              // N: ชื่อตัวเลือกสินค้าหลัก
    xlsxRow.getCell(15).value = val1;                                                   // O: ค่าตัวเลือกสินค้าหลัก
    xlsxRow.getCell(16).value = variantImgFilename;                                     // P: ตัวเลือกสินค้าหลักภาพที่ 1
    xlsxRow.getCell(17).value = attr2Name;                                              // Q: ชื่อตัวเลือกสินค้ารอง
    xlsxRow.getCell(18).value = val2;                                                   // R: ค่าตัวเลือกสินค้ารอง
    xlsxRow.getCell(19).value = Math.round(data.weight * 1000);                         // S: น้ำหนักพัสดุ(g)
    xlsxRow.getCell(20).value = data.length;                                            // T: ความยาวของพัสดุ(cm)
    xlsxRow.getCell(21).value = data.width;                                             // U: ความกว้างของพัสดุ(cm)
    xlsxRow.getCell(22).value = data.height;                                            // V: ความสูงของพัสดุ(cm)
    xlsxRow.getCell(23).value = "ตัวเลือกในการจัดส่งสำหรับสินค้านี้เหมือนกับตัวเลือกในการจัดส่งสำหรับร้านค้า"; // W: ตัวเลือกในการจัดส่ง
    xlsxRow.getCell(24).value = parseFloat(row.price) || 0;                            // X: ราคาขายปลีก
    xlsxRow.getCell(25).value = "";                                                     // Y: เปิดขายล่วงหน้า
    xlsxRow.getCell(26).value = parseInt(row.stock) || 0;                               // Z: ปริมาณ
    xlsxRow.getCell(27).value = row.sku;                                                // AA: SKU ของผู้ขาย
    xlsxRow.getCell(28).value = "";                                                     // AB: ตารางขนาด

    xlsxRow.commit(); // Commit row changes
  });

  // 4. Generate modified workbook back as ArrayBuffer
  const outputBuffer = await workbook.xlsx.writeBuffer();
  
  return new Uint8Array(outputBuffer);
}
