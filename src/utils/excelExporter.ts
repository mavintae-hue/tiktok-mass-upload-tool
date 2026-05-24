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
 * Generates an Excel spreadsheet buffer matching the TikTok Shop Multi-Variant Mass Upload format.
 */
export async function generateTikTokExcelBuffer(data: ExcelExportData): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TikTok Shop Mass Upload Tool";
  workbook.lastModifiedBy = "TikTok Shop Mass Upload Tool";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Create TikTok Bulk Sheet
  const worksheet = workbook.addWorksheet("TikTok Shop Mass Upload", {
    views: [{ showGridLines: true }],
  });

  // Define Columns
  worksheet.columns = [
    { header: "Product Name*", key: "productName", width: 35 },
    { header: "Product Description*", key: "description", width: 50 },
    { header: "Category Suggestion", key: "category", width: 25 },
    { header: "Shipping Weight (kg)*", key: "weight", width: 20 },
    { header: "Length (cm)*", key: "length", width: 15 },
    { header: "Width (cm)*", key: "width", width: 15 },
    { header: "Height (cm)*", key: "height", width: 15 },
    { header: "Variant Attribute 1 Name", key: "attr1Name", width: 22 },
    { header: "Variant Attribute 1 Value", key: "attr1Value", width: 22 },
    { header: "Variant Attribute 2 Name", key: "attr2Name", width: 22 },
    { header: "Variant Attribute 2 Value", key: "attr2Value", width: 22 },
    { header: "Seller SKU*", key: "sku", width: 25 },
    { header: "Price (THB)*", key: "price", width: 15 },
    { header: "Stock Quantity*", key: "stock", width: 15 },
    { header: "Main Image 1*", key: "mainImg1", width: 20 },
    { header: "Main Image 2", key: "mainImg2", width: 20 },
    { header: "Main Image 3", key: "mainImg3", width: 20 },
    { header: "Variant Image File", key: "variantImg", width: 22 },
  ];

  // Apply Beautiful Header Styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Sleek Slate 900
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "medium", color: { argb: "FF1E293B" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Category Placement Suggestion helper logic
  let categorySuggestion = "Health & Personal Care > Beauty & Cosmetics";
  const nameLower = data.productName.toLowerCase();
  if (nameLower.includes("serum") || nameLower.includes("cream") || nameLower.includes("skin") || nameLower.includes("เซรั่ม") || nameLower.includes("ครีม")) {
    categorySuggestion = "Beauty & Personal Care > Skincare > Facial Serum & Essence";
  } else if (nameLower.includes("shampoo") || nameLower.includes("hair") || nameLower.includes("แชมพู")) {
    categorySuggestion = "Beauty & Personal Care > Haircare > Shampoo & Conditioner";
  } else if (nameLower.includes("food") || nameLower.includes("supplement") || nameLower.includes("วิตามิน") || nameLower.includes("อาหารเสริม")) {
    categorySuggestion = "Food & Beverages > Health Supplements";
  }

  // Populate dynamic rows
  const activeAttributes = data.attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );

  const attr1Name = activeAttributes[0]?.name || "";
  const attr2Name = activeAttributes[1]?.name || "";

  data.skuRows.forEach((row) => {
    const val1 = activeAttributes[0] ? row.combination[attr1Name] || "" : "";
    const val2 = activeAttributes[1] ? row.combination[attr2Name] || "" : "";

    // Map variant image filename (based on the first attribute, e.g. Color)
    let variantImgFilename = "";
    if (val1 && attr1Name.toLowerCase().includes("color") || attr1Name.toLowerCase().includes("สี")) {
      const sanitizedVal = val1.toLowerCase().replace(/[^a-z0-9ก-๙_-]/g, "").replace(/\s+/g, "-");
      variantImgFilename = `variant_${sanitizedVal}.jpg`;
    }

    const rowData = {
      productName: data.productName,
      description: data.description,
      category: categorySuggestion,
      weight: data.weight,
      length: data.length,
      width: data.width,
      height: data.height,
      attr1Name: attr1Name,
      attr1Value: val1,
      attr2Name: attr2Name,
      attr2Value: val2,
      sku: row.sku,
      price: parseFloat(row.price) || 0,
      stock: parseInt(row.stock) || 0,
      mainImg1: data.mainImagesCount >= 1 ? "main_1.jpg" : "",
      mainImg2: data.mainImagesCount >= 2 ? "main_2.jpg" : "",
      mainImg3: data.mainImagesCount >= 3 ? "main_3.jpg" : "",
      variantImg: variantImgFilename,
    };

    const addedRow = worksheet.addRow(rowData);
    addedRow.height = 24;
    addedRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    // Align numeric fields
    addedRow.getCell("weight").alignment = { horizontal: "right", vertical: "middle" };
    addedRow.getCell("length").alignment = { horizontal: "right", vertical: "middle" };
    addedRow.getCell("width").alignment = { horizontal: "right", vertical: "middle" };
    addedRow.getCell("height").alignment = { horizontal: "right", vertical: "middle" };
    addedRow.getCell("price").alignment = { horizontal: "right", vertical: "middle" };
    addedRow.getCell("stock").alignment = { horizontal: "right", vertical: "middle" };
  });

  // Write sheet as a standard ArrayBuffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}
