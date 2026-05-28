const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "public", "Tiktoksellercenter_batchupload_20260528_template.xlsx");
console.log("Loading template from:", filePath);

try {
  const workbook = XLSX.readFile(filePath);
  const ws = workbook.Sheets['Template'];
  if (!ws) {
    console.error("Sheet 'Template' not found.");
    process.exit(1);
  }
  
  console.log("Sheet !ref range:", ws['!ref']);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  console.log(`Dimensions: rows = ${range.e.r + 1}, columns = ${range.e.c + 1}`);
  
  // Print headers for every column in the range
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row0 = data[0] || [];
  const row1 = data[1] || [];
  const row2 = data[2] || [];
  
  console.log("\n--- Vertical listing of all columns up to the end ---");
  for (let c = 0; c <= range.e.c; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    console.log(`Col ${c} (${colLetter}):`);
    console.log(`  Row 0 (Name):`, JSON.stringify(row0[c] || null));
    console.log(`  Row 1 (Mandatory):`, JSON.stringify(row1[c] || null));
    console.log(`  Row 2 (Sample):`, JSON.stringify(row2[c] ? String(row2[c]).substring(0, 50) : null));
  }
} catch (err) {
  console.error("Error:", err);
}
