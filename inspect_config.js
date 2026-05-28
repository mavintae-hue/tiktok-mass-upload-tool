const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "public", "Tiktoksellercenter_batchupload_20260528_template.xlsx");

try {
  const workbook = XLSX.readFile(filePath);
  const ws = workbook.Sheets['TemplateConfig'];
  if (!ws) {
    console.error("Sheet 'TemplateConfig' not found.");
    process.exit(1);
  }
  
  console.log("TemplateConfig !ref range:", ws['!ref']);
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  console.log("\n--- Row 0 (Columns of TemplateConfig) ---");
  const row0 = data[0] || [];
  console.log(`Total columns in TemplateConfig: ${row0.length}`);
  row0.forEach((col, idx) => {
    console.log(`Col ${idx} (${XLSX.utils.encode_col(idx)}): ${JSON.stringify(col)}`);
  });
} catch (err) {
  console.error("Error:", err);
}
