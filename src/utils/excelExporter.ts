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
 * Generates an Excel spreadsheet buffer matching the TikTok Shop Bulk Upload format using the browser-safe SheetJS (xlsx) library.
 */
export async function generateTikTokExcelBuffer(data: ExcelExportData): Promise<Uint8Array> {
  // 1. Map dynamic categories based on keywords
  let categorySuggestion = "Health & Personal Care > Beauty & Cosmetics";
  const nameLower = data.productName.toLowerCase();
  if (
    nameLower.includes("serum") ||
    nameLower.includes("cream") ||
    nameLower.includes("skin") ||
    nameLower.includes("เซรั่ม") ||
    nameLower.includes("ครีม")
  ) {
    categorySuggestion = "Beauty & Personal Care > Skincare > Facial Serum & Essence";
  } else if (nameLower.includes("shampoo") || nameLower.includes("hair") || nameLower.includes("แชมพู")) {
    categorySuggestion = "Beauty & Personal Care > Haircare > Shampoo & Conditioner";
  } else if (nameLower.includes("food") || nameLower.includes("supplement") || nameLower.includes("วิตามิน") || nameLower.includes("อาหารเสริม")) {
    categorySuggestion = "Food & Beverages > Health Supplements";
  }

  // 2. Extract active attributes
  const activeAttributes = data.attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );
  const attr1Name = activeAttributes[0]?.name || "";
  const attr2Name = activeAttributes[1]?.name || "";

  // 3. Map dynamic rows
  const sheetRows = data.skuRows.map((row) => {
    const val1 = activeAttributes[0] ? row.combination[attr1Name] || "" : "";
    const val2 = activeAttributes[1] ? row.combination[attr2Name] || "" : "";

    // Map variant image filename (based on the first attribute, e.g. Color)
    let variantImgFilename = "";
    if (val1 && (attr1Name.toLowerCase().includes("color") || attr1Name.toLowerCase().includes("สี"))) {
      const sanitizedVal = val1.toLowerCase().replace(/[^a-z0-9ก-๙_-]/g, "").replace(/\s+/g, "-");
      variantImgFilename = `variant_${sanitizedVal}.jpg`;
    }

    return {
      "Product Name*": data.productName,
      "Product Description*": data.description,
      "Category Suggestion": categorySuggestion,
      "Shipping Weight (kg)*": data.weight,
      "Length (cm)*": data.length,
      "Width (cm)*": data.width,
      "Height (cm)*": data.height,
      "Variant Attribute 1 Name": attr1Name,
      "Variant Attribute 1 Value": val1,
      "Variant Attribute 2 Name": attr2Name,
      "Variant Attribute 2 Value": val2,
      "Seller SKU*": row.sku,
      "Price (THB)*": parseFloat(row.price) || 0,
      "Stock Quantity*": parseInt(row.stock) || 0,
      "Main Image 1*": data.mainImagesCount >= 1 ? "main_1.jpg" : "",
      "Main Image 2": data.mainImagesCount >= 2 ? "main_2.jpg" : "",
      "Main Image 3": data.mainImagesCount >= 3 ? "main_3.jpg" : "",
      "Variant Image File": variantImgFilename,
    };
  });

  // 4. Create SheetJS Workbook and Worksheet
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "TikTok Shop Upload");

  // 5. Generate XLSX file binary buffer (pure client-side execution)
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  
  return new Uint8Array(excelBuffer);
}
