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

  console.log("\n--- Full details of columns AC (28) to BA (52) ---");
  for (let c = 28; c <= 52; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    console.log(`\n================= COLUMN ${colLetter} (Col index ${c}) =================`);
    for (let r = 0; r <= 6; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (cell) {
        console.log(`  Row ${r + 1} (${cellRef}): [t: ${cell.t}] = ${JSON.stringify(cell.v)}`);
      } else {
        console.log(`  Row ${r + 1} (${cellRef}): EMPTY`);
      }
    }
  }
} catch (err) {
  console.error("Error:", err);
}
