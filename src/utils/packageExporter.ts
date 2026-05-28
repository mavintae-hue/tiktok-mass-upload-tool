import JSZip from "jszip";
import { generateTikTokExcelBuffer, ExcelExportData } from "./excelExporter";

export interface PackageExportData {
  excelData: ExcelExportData;
  mainImages: string[];    // Array of base64 data URLs
  variantImages: Record<string, string>; // Mapping of option values (e.g. "Black") to base64 data URLs
}

/**
 * Converts a Base64 Data URL (e.g., "data:image/jpeg;base64,...") into a clean Base64 payload string for JSZip.
 */
function extractBase64Payload(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return dataUrl;
  }
  return dataUrl.substring(commaIndex + 1);
}

/**
 * Packages the formatted TikTok upload Excel sheet and all 1:1 corporate-branded JPEGs into a downloadable ZIP archive.
 */
export async function exportTikTokMassUploadPackage(
  data: PackageExportData
): Promise<void> {
  const zip = new JSZip();

  // 1. Generate the Excel Spreadsheet
  const excelBuffer = await generateTikTokExcelBuffer(data.excelData);
  const sanitizedName = data.excelData.productName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F_-]/g, "")
    .replace(/\s+/g, "-");
  
  const dateStr = new Date().toISOString().split("T")[0];
  const excelFilename = `tiktok_upload_sheet_${sanitizedName || "product"}_${dateStr}.xlsx`;
  
  // Add Excel file to ZIP root
  zip.file(excelFilename, excelBuffer);

  // 2. Add Main Images to ZIP
  // Filenames: main_1.jpg, main_2.jpg, ...
  const imagesFolder = zip.folder("product_images");
  const folderToUse = imagesFolder || zip;

  data.mainImages.forEach((imgBase64, index) => {
    const cleanBase64 = extractBase64Payload(imgBase64);
    folderToUse.file(`main_${index + 1}.jpg`, cleanBase64, { base64: true });
  });

  // 3. Add Variant Images to ZIP
  // Filename matches first attribute values: e.g. variant_black.jpg, variant_white.jpg
  const activeAttributes = data.excelData.attributes.filter(
    (attr) => attr.name.trim() !== "" && attr.values.length > 0
  );
  
  const firstAttrName = activeAttributes[0]?.name || "";
  
  if (firstAttrName) {
    Object.entries(data.variantImages).forEach(([optionVal, imgBase64]) => {
      // Naming format matches row lookup: variant_[sanitizedVal].jpg
      const sanitizedVal = optionVal
        .toLowerCase()
        .replace(/[^a-z0-9\u0E00-\u0E7F_-]/g, "")
        .replace(/\s+/g, "-");
      
      const cleanBase64 = extractBase64Payload(imgBase64);
      folderToUse.file(`variant_${sanitizedVal}.jpg`, cleanBase64, { base64: true });
    });
  }

  // 4. Generate the ZIP blob
  const zipBlob = await zip.generateAsync({ type: "blob" });

  // 5. Trigger Web Browser Download
  const zipFilename = `tiktok_mass_upload_${sanitizedName || "package"}_${dateStr}.zip`;
  
  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
