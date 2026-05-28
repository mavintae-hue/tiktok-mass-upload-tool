const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "public", "Tiktoksellercenter_batchupload_20260528_template.xlsx");

try {
  const workbook = XLSX.readFile(filePath);
  const ws = workbook.Sheets['Template'];
  if (!ws) {
    console.error("Sheet 'Template' not found.");
    process.exit(1);
  }
  
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const r0 = data[0] || [];
  const r1 = data[1] || [];
  const r2 = data[2] || [];
  
  console.log("\n--- Vertical listing of columns 28 (AC) to 52 (BA) ---");
  for (let c = 28; c <= 52; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    console.log(`Col ${c} (${colLetter}):`);
    console.log(`  Row 0 (Name):`, JSON.stringify(r0[c] || null));
    console.log(`  Row 1 (Mandatory):`, JSON.stringify(r1[c] || null));
    console.log(`  Row 2 (Sample):`, JSON.stringify(r2[c] ? String(r2[c]).substring(0, 50) : null));
  }
} catch (err) {
  console.error("Error:", err);
}
