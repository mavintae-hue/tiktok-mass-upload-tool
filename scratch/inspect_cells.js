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
  
  const keys = Object.keys(ws).filter(k => k[0] !== '!');
  
  const colDetails = {};
  for (let c = 28; c <= 52; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    colDetails[colLetter] = [];
  }

  keys.forEach(key => {
    const cell = XLSX.utils.decode_cell(key);
    if (cell.c >= 28 && cell.c <= 52) {
      const colLetter = XLSX.utils.encode_col(cell.c);
      const val = ws[key];
      if (val && val.v !== undefined && val.v !== null && String(val.v).trim() !== "") {
        colDetails[colLetter].push({ row: cell.r + 1, val: val.v });
      }
    }
  });

  console.log("\n--- Active cells in columns AC (28) to BA (52) ---");
  for (let c = 28; c <= 52; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const active = colDetails[colLetter];
    if (active.length > 0) {
      console.log(`Column ${colLetter}:`);
      active.forEach(item => {
        console.log(`  Row ${item.row}: ${JSON.stringify(item.val)}`);
      });
    } else {
      console.log(`Column ${colLetter}: (All cells are empty/null)`);
    }
  }
} catch (err) {
  console.error("Error:", err);
}
