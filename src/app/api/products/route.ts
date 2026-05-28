import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

// Path to the Excel file and cached JSON file
const EXCEL_FILE_PATH = path.join(process.cwd(), "src", "data", "DT ONLINE_CORE SKU List data as of 17 May'26.xlsx");

// Detect serverless environments (like Vercel AWS Lambda) where the workspace is read-only
const isServerless = typeof process !== "undefined" && (process.env.VERCEL || process.env.NODE_ENV === "production" || process.cwd().includes("var/task"));
const CACHE_DIR = isServerless ? "/tmp" : path.join(process.cwd(), "src", "data");
const CACHE_FILE_PATH = path.join(CACHE_DIR, "products.json");

// Read-only fallback cache inside the deployment bundle
const READONLY_CACHE_FILE_PATH = path.join(process.cwd(), "src", "data", "products.json");

interface ProductItem {
  code: string;
  focusItem: string;
  name: string;
  thDesc: string;
  onlineName: string;
  type: string;
  brand: string;
  size: string;
  packCs: number;
  innerPack: number;
  weightGrams: number;
  rspPrice: number;
  onlinePrice: number;
  description: string;
  hasPriceChange?: boolean;
}

interface ProductGroup {
  groupName: string;
  brand: string;
  category: string;
  avgWeightKg: number;
  items: ProductItem[];
}

interface PriceChange {
  itemCode: string;
  groupName: string;
  name: string;
  oldOnline: number;
  newOnline: number;
  oldRsp: number;
  newRsp: number;
}

interface ParsedCache {
  lastUpdated: string;
  excelMtime: number;
  groups: Record<string, ProductGroup>;
  priceChanges: PriceChange[];
}

// Helper to ensure the cache folder exists (fail-safe for read-only environments)
function ensureCacheDirExists() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn(`[WARNING] Failed to ensure cache directory: ${CACHE_DIR}. Proceeding with in-memory execution.`, err);
  }
}

// Helper to write to JSON cache safely
function writeToCache(data: ParsedCache) {
  try {
    ensureCacheDirExists();
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[WARNING] Failed to write cache file to: ${CACHE_FILE_PATH}. Cache will be in-memory only.`, err);
  }
}

// Core parsing logic
function parseExcelData(previousCache: ParsedCache | null): ParsedCache {
  if (!fs.existsSync(EXCEL_FILE_PATH)) {
    throw new Error(`Excel source file not found at ${EXCEL_FILE_PATH}`);
  }

  // Load workbook
  const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  
  // Sheet 1: Product list & Price
  const ws1 = workbook.Sheets['Product list & Price'];
  if (!ws1) {
    throw new Error("Sheet 'Product list & Price' not found in Excel workbook.");
  }
  const data1 = XLSX.utils.sheet_to_json<any[]>(ws1, { header: 1 });

  // Sheet 2: Product name & description
  const ws2 = workbook.Sheets['Product name & description'];
  const data2 = ws2 ? XLSX.utils.sheet_to_json<any[]>(ws2, { header: 1 }) : [];

  // Build description map from Sheet 2
  const descMap: Record<string, string> = {};
  data2.forEach((row) => {
    if (row && row[1]) {
      const code = String(row[1]).trim();
      const desc = row[5] || "";
      descMap[code] = desc;
    }
  });

  // Build old price lookup map from previous cache to check differences
  const oldPriceMap: Record<string, { online: number; rsp: number }> = {};
  if (previousCache && previousCache.groups) {
    Object.values(previousCache.groups).forEach((group) => {
      group.items.forEach((item) => {
        oldPriceMap[item.code] = {
          online: item.onlinePrice,
          rsp: item.rspPrice
        };
      });
    });
  }

  const groups: Record<string, ProductGroup> = {};
  const priceChanges: PriceChange[] = [];

  // Headers are at Row 7. Data starts at Row 9
  for (let i = 9; i < data1.length; i++) {
    const row = data1[i];
    if (!row || row.length < 9) continue;

    const focusItem = String(row[0] || "").trim();
    const groupName = String(row[1] || "").trim();
    const code = String(row[2] || "").trim();
    const name = String(row[3] || "").trim();
    const thDesc = String(row[4] || "").trim();
    const onlineName = String(row[5] || "").trim();
    const type = String(row[6] || "").trim();
    const brand = String(row[7] || "").trim();
    const size = String(row[8] || "").trim();
    const packCs = Number(row[9] || 0);
    const innerPack = Number(row[10] || 0);
    const weightGrams = Number(row[12] || 0);
    
    // RSP normal company price (Column index 29)
    const rspPrice = Number(row[29] || 0);
    // Online price (Column index 32)
    const onlinePrice = Number(row[32] || 0);

    if (!groupName || !code) continue;

    // Check for price changes
    const oldPrices = oldPriceMap[code];
    let hasPriceChange = false;
    if (oldPrices) {
      const onlineChanged = oldPrices.online !== onlinePrice;
      const rspChanged = oldPrices.rsp !== rspPrice;
      if (onlineChanged || rspChanged) {
        hasPriceChange = true;
        priceChanges.push({
          itemCode: code,
          groupName,
          name: onlineName || thDesc || name,
          oldOnline: oldPrices.online,
          newOnline: onlinePrice,
          oldRsp: oldPrices.rsp,
          newRsp: rspPrice
        });
      }
    }

    const item: ProductItem = {
      code,
      focusItem,
      name,
      thDesc,
      onlineName: onlineName || thDesc || name,
      type,
      brand,
      size,
      packCs,
      innerPack,
      weightGrams,
      rspPrice,
      onlinePrice,
      description: descMap[code] || "",
      hasPriceChange
    };

    if (!groups[groupName]) {
      groups[groupName] = {
        groupName,
        brand: brand || "Unbranded",
        category: type || "General",
        avgWeightKg: 0,
        items: []
      };
    }

    groups[groupName].items.push(item);
  }

  // Calculate average weight and flag groups with price changes
  Object.keys(groups).forEach((gName) => {
    const group = groups[gName];
    const totalGrams = group.items.reduce((acc, item) => acc + item.weightGrams, 0);
    const avgGrams = totalGrams / group.items.length;
    group.avgWeightKg = parseFloat((avgGrams / 1000).toFixed(3)); // Convert to kg
  });

  const mtime = fs.statSync(EXCEL_FILE_PATH).mtimeMs;

  return {
    lastUpdated: new Date().toISOString(),
    excelMtime: mtime,
    groups,
    priceChanges
  };
}

// GET Endpoint: Reads and returns product list from cache (or auto-generates if missing/stale)
export async function GET() {
  try {
    ensureCacheDirExists();

    let cacheData: ParsedCache | null = null;
    let excelMtime = 0;

    if (fs.existsSync(EXCEL_FILE_PATH)) {
      excelMtime = fs.statSync(EXCEL_FILE_PATH).mtimeMs;
    }

    // Check if cache file exists in writable cache
    if (fs.existsSync(CACHE_FILE_PATH)) {
      try {
        const rawCache = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
        cacheData = JSON.parse(rawCache);
      } catch (err) {
        console.warn("Stale or invalid JSON cache file. Will re-parse.", err);
      }
    }

    // Fallback to read-only pre-packaged cache if writable cache is empty
    if (!cacheData && fs.existsSync(READONLY_CACHE_FILE_PATH)) {
      try {
        const rawCache = fs.readFileSync(READONLY_CACHE_FILE_PATH, "utf-8");
        cacheData = JSON.parse(rawCache);
        console.log("Loaded pre-packaged cache from src/data/products.json");
      } catch (err) {
        console.warn("Stale or invalid read-only JSON cache file.", err);
      }
    }

    // Re-parse if cache is missing or stale. On serverless, we rely on the pre-packaged cache first and don't force re-parse on GET unless cache is completely missing.
    const isStale = isServerless ? !cacheData : (!cacheData || cacheData.excelMtime !== excelMtime);
    if (isStale) {
      console.log("Cache is stale or missing. Parsing Excel sheet...");
      cacheData = parseExcelData(cacheData);
      writeToCache(cacheData);
    }

    if (!cacheData) {
      throw new Error("Unable to load or parse product cache data.");
    }

    return NextResponse.json({
      success: true,
      lastUpdated: cacheData.lastUpdated,
      excelModified: new Date(cacheData.excelMtime).toLocaleString("th-TH"),
      groups: Object.values(cacheData.groups),
      priceChanges: cacheData.priceChanges || []
    });
  } catch (error: any) {
    console.error("GET Products Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred while loading products." },
      { status: 500 }
    );
  }
}

// POST Endpoint: Forces a manual refresh/re-parse of the Excel spreadsheet
export async function POST() {
  try {
    ensureCacheDirExists();

    let cacheData: ParsedCache | null = null;
    if (fs.existsSync(CACHE_FILE_PATH)) {
      try {
        const rawCache = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
        cacheData = JSON.parse(rawCache);
      } catch (e) {
        console.warn("Could not read previous cache for price comparison.");
      }
    }

    console.log("Forcing manual Excel sync...");
    const freshCache = parseExcelData(cacheData);
    writeToCache(freshCache);

    return NextResponse.json({
      success: true,
      lastUpdated: freshCache.lastUpdated,
      excelModified: new Date(freshCache.excelMtime).toLocaleString("th-TH"),
      groups: Object.values(freshCache.groups),
      priceChanges: freshCache.priceChanges || [],
      message: "อัปเดตซิงค์ข้อมูลจาก Excel สำเร็จแล้ว!"
    });
  } catch (error: any) {
    console.error("POST Products Sync Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred while syncing products." },
      { status: 500 }
    );
  }
}
