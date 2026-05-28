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
  
  // Get all keys
  const keys = Object.keys(ws).filter(k => k[0] !== '!');
  console.log(`Total cell keys: ${keys.length}`);
  
  let maxColIdx = 0;
  let maxRowIdx = 0;
  
  keys.forEach(key => {
    const cell = XLSX.utils.decode_cell(key);
    if (cell.c > maxColIdx) maxColIdx = cell.c;
    if (cell.r > maxRowIdx) maxRowIdx = cell.r;
  });
  
  console.log(`Max cell found at row index: ${maxRowIdx} (Row ${maxRowIdx + 1})`);
  console.log(`Max cell found at col index: ${maxColIdx} (Column ${XLSX.utils.encode_col(maxColIdx)})`);
  
  // Let's print all cell keys in row 0
  const row0Keys = keys.filter(k => k.replace(/^[A-Z]+/, '') === '1').sort((a, b) => {
    return XLSX.utils.decode_cell(a).c - XLSX.utils.decode_cell(b).c;
  });
  
  console.log("\nRow 1 cell keys in Template:");
  console.log(row0Keys.slice(0, 10), "...total", row0Keys.length);
  console.log("Last row 1 cell key:", row0Keys[row0Keys.length - 1]);
} catch (err) {
  console.error("Error:", err);
}
