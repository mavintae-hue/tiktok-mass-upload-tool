const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join("c:", "Projects", "tiktok-mass-upload-tool", "public", "Tiktoksellercenter_batchupload_20260528_template.xlsx");

try {
  const workbook = XLSX.readFile(filePath);
  const ws = workbook.Sheets['Template'];
  if (!ws) {
    console.error("Sheet 'Template' not found.");
    process.exit(1);
  }

  console.log("\n--- Bounding Box / Bounding ref ---");
  console.log(ws['!ref']);

  console.log("\n--- Core columns A to AB Sample Data in Row 6 ---");
  for (let c = 0; c <= 27; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const cellRef = XLSX.utils.encode_cell({ r: 5, c }); // Row 6 (Index 5)
    const cell = ws[cellRef];
    console.log(`Column ${colLetter} (index ${c}) [${ws[XLSX.utils.encode_cell({ r: 0, c })]?.v || "No Header"}]:`);
    console.log(`  Value: ${cell ? JSON.stringify(cell.v) : "(Empty)"}`);
  }
} catch (err) {
  console.error("Error:", err);
}
