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

  console.log("\n=================== TIKTOK SHOP BATCH UPLOAD TEMPLATE V5 ===================");
  console.log("Column range: AC (28) to BA (52) - Total 25 Attribute & Qualification Columns\n");

  for (let c = 28; c <= 52; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const row1Key = XLSX.utils.encode_cell({ r: 0, c }); // Row 1 (Index 0)
    const row3Key = XLSX.utils.encode_cell({ r: 2, c }); // Row 3 (Index 2)
    const row4Key = XLSX.utils.encode_cell({ r: 3, c }); // Row 4 (Index 3)
    
    const idVal = ws[row1Key] ? ws[row1Key].v : "N/A";
    const nameVal = ws[row3Key] ? ws[row3Key].v : "(Empty)";
    const reqVal = ws[row4Key] ? ws[row4Key].v : "N/A";

    console.log(`Column ${colLetter} (index ${c}):`);
    console.log(`  - ID:   ${idVal}`);
    console.log(`  - Name: ${nameVal}`);
    console.log(`  - Status: ${reqVal}`);
  }
} catch (err) {
  console.error("Error:", err);
}
