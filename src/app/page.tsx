"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Sparkles,
  Eye,
  Download,
  Plus,
  Trash2,
  Settings,
  Package,
  Layers,
  Ruler,
  Coins,
  CheckCircle,
  AlertCircle,
  Info,
  RefreshCw,
  Search,
  Check,
  ChevronDown,
  AlertTriangle,
  Image as ImageIcon
} from "lucide-react";
import {
  getCartesianProduct,
  generateSkuString,
  SkuRow,
  VariantAttribute
} from "@/utils/variantGenerator";
import { processBrandedImage, BrandingOptions } from "@/utils/imageBranding";
import { exportTikTokMassUploadPackage } from "@/utils/packageExporter";
import * as XLSX from "xlsx";

// Interface for matched products from Excel
interface ExcelProductItem {
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

interface ExcelProductGroup {
  groupName: string;
  brand: string;
  category: string;
  avgWeightKg: number;
  items: ExcelProductItem[];
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

// Heuristic cleaning function to extract clean variant values (colors/flavors/options)
function cleanVariantValue(onlineName: string, size: string, brand: string): string {
  let val = onlineName;
  if (size) {
    const sizeClean = size.replace(/ML/i, " มล").replace(/G/i, " กรัม");
    val = val.replace(new RegExp(sizeClean, 'gi'), '');
    val = val.replace(new RegExp(size, 'gi'), '');
  }
  if (brand) {
    val = val.replace(new RegExp(brand, 'gi'), '');
  }
  val = val.replace(/(คอมฟอร์ท|โอโม|ซันไลต์|คนอร์|บรีส|ซิตร้า|Comfort|Omo|Sunlight|Knorr|Breeze|Citra)/gi, '');
  val = val.replace(/(น้ำปรับผ้านุ่มสูตรมาตรฐาน|ผงซักฟอก สูตรมาตรฐาน|น้ำยาล้างจาน สูตร|น้ำยาซักผ้า|ผงซักฟอก|สูตรเข้มข้น|สูตรมาตรฐาน|โจ๊กคัพ|โจ๊กซองสำเร็จรูป|ซุปก้อน|โลชั่นทาผิว|น้ำปรับผ้านุ่ม|ชนิดน้ำ|โลชั่น)/gi, '');
  val = val.replace(/[()\[\]\-+]/g, ' ');
  val = val.replace(/\s+/g, ' ').trim();
  return val || onlineName;
}

export default function TikTokDashboard() {
  // --- ข้อมูลตัวสินค้าหลัก ---
  const [productName, setProductName] = useState("");
  const [weight, setWeight] = useState("0.25");
  const [length, setLength] = useState("15");
  const [width, setWidth] = useState("15");
  const [height, setHeight] = useState("10");
  const [skuPrefix, setSkuPrefix] = useState("TK");

  // --- การตั้งค่าคุณลักษณะตัวเลือกสินค้า (Dynamic Variants) ---
  const [attributes, setAttributes] = useState<VariantAttribute[]>([
    { name: "Color", values: ["Black", "White"] },
    { name: "Size", values: ["S", "M", "L"] }
  ]);
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);

  // --- จัดการรูปภาพสินค้า ---
  const [mainImages, setMainImages] = useState<Array<{ id: string; file: File; preview: string; processed: string | null }>>([]);
  const [variantImages, setVariantImages] = useState<Record<string, { file: File; preview: string; processed: string | null }>>({});
  
  // --- ตั้งค่ากรอบรูปภาพแบรนด์ร้านค้า (Corporate Branding) ---
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoText, setLogoText] = useState("STORE BRAND");
  const [logoScale, setLogoScale] = useState(1.0);
  const [aspectMode, setAspectMode] = useState<"cover" | "contain">("contain");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [frameStyle, setFrameStyle] = useState<BrandingOptions["frameStyle"]>("minimalist-corners");
  const [frameColor, setFrameColor] = useState("#FF4E00"); // สีส้มแบรนดิ้งพรีเมียม
  const [customFrameFile, setCustomFrameFile] = useState<File | null>(null);

  // --- ข้อมูลที่แนะนำโดย AI Gemini ---
  const [aiContent, setAiContent] = useState<{
    tiktok_title: string;
    description: string;
    market_price_analysis: string;
  } | null>(null);

  // --- สถานะการโหลดและการแจ้งเตือน (Toast States) ---
  const [aiLoading, setAiLoading] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // --- สถานะพรีวิวภาพที่ใส่กรอบ ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // --- ส่วนขยายข้อมูลจาก Excel (New Excel Features) ---
  const [productGroups, setProductGroups] = useState<ExcelProductGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ExcelProductGroup | null>(null);
  const [pricingMode, setPricingMode] = useState<"online" | "rsp">("online");
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [excelModifiedDate, setExcelModifiedDate] = useState<string>("");
  
  // โลคัลสเตตสำหรับ Dropdown ค้นหาและสถานะการอัปโหลด
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [completedGroups, setCompletedGroups] = useState<string[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ปิดแจ้งเตือนอัตโนมัติ
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // จัดการการปิดคลิกนอกกล่อง Dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- โหลดข้อมูลกลุ่มสินค้าจาก Excel และ localStorage ในครั้งแรก ---
  useEffect(() => {
    fetchProductGroups();
    
    // โหลดประวัติความสำเร็จจาก LocalStorage
    const savedCompleted = localStorage.getItem("tiktok_completed_groups");
    if (savedCompleted) {
      try {
        setCompletedGroups(JSON.parse(savedCompleted));
      } catch (e) {
        console.error("Error loading completed groups from localStorage", e);
      }
    }
  }, []);

  // ฟังก์ชันดึงข้อมูลสินค้าจาก API
  const fetchProductGroups = async (forceSync = false) => {
    if (forceSync) setSyncLoading(true);
    try {
      const endpoint = "/api/products";
      const method = forceSync ? "POST" : "GET";
      
      const res = await fetch(endpoint, { method });
      const data = await res.json();
      
      if (data.success) {
        setProductGroups(data.groups || []);
        setPriceChanges(data.priceChanges || []);
        if (data.excelModified) {
          setExcelModifiedDate(data.excelModified);
        }
        if (forceSync) {
          setToast({ 
            type: "success", 
            message: `ซิงค์สำเร็จ! ดึงข้อมูลสำเร็จ ${data.groups?.length || 0} กลุ่มสินค้า และตรวจพบราคาเปลี่ยน ${data.priceChanges?.length || 0} รายการ` 
          });
        }
      } else {
        throw new Error(data.error || "Failed to load product database");
      }
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `ไม่สามารถโหลดข้อมูลสินค้าจาก Excel ได้: ${err.message || err}` });
    } finally {
      if (forceSync) setSyncLoading(false);
    }
  };

  // ฟังก์ชันอัปโหลดและแกะข้อมูล Excel ฝั่ง Client-side (เป็นระบบ Fallback สำรองหากเซิร์ฟเวอร์โหลดไฟล์ไม่ได้)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    setSyncLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("ไม่สามารถอ่านข้อมูลไฟล์ได้");
        
        const workbook = XLSX.read(data, { type: "array" });
        
        const ws1 = workbook.Sheets['Product list & Price'];
        if (!ws1) {
          throw new Error("ไม่พบชีต 'Product list & Price' ในไฟล์ Excel ที่เลือก");
        }
        const data1 = XLSX.utils.sheet_to_json<any[]>(ws1, { header: 1 });

        const ws2 = workbook.Sheets['Product name & description'];
        const data2 = ws2 ? XLSX.utils.sheet_to_json<any[]>(ws2, { header: 1 }) : [];

        // สร้างแผนที่คำอธิบายจาก ชีต 2
        const descMap: Record<string, string> = {};
        data2.forEach((row: any) => {
          if (row && row[1]) {
            const code = String(row[1]).trim();
            const desc = row[5] || "";
            descMap[code] = desc;
          }
        });

        const groups: Record<string, ExcelProductGroup> = {};

        // หัวตารางอยู่ที่แถวที่ 7. ข้อมูลเริ่มที่แถวที่ 9 (ดัชนี 8)
        for (let i = 8; i < data1.length; i++) {
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
          
          const rspPrice = Number(row[29] || 0);
          const onlinePrice = Number(row[32] || 0);

          if (!groupName || !code) continue;

          const item: ExcelProductItem = {
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
            hasPriceChange: false
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

        Object.keys(groups).forEach((gName) => {
          const group = groups[gName];
          const totalGrams = group.items.reduce((acc, item) => acc + item.weightGrams, 0);
          const avgGrams = totalGrams / group.items.length;
          group.avgWeightKg = parseFloat((avgGrams / 1000).toFixed(3));
        });

        const parsedGroups = Object.values(groups);
        setProductGroups(parsedGroups);
        setExcelModifiedDate(`${new Date().toLocaleDateString("th-TH")} (อัปโหลดเอง)`);
        setToast({
          type: "success",
          message: `โหลดสำเร็จ! อ่านข้อมูลสำเร็จ ${parsedGroups.length} กลุ่มสินค้าจากไฟล์ที่คุณอัปโหลดโดยตรง`
        });
      } catch (err: any) {
        console.error("Client Excel upload parsing error:", err);
        setToast({ type: "error", message: `ไม่สามารถอ่านโครงสร้างไฟล์ Excel ได้: ${err.message || err}` });
      } finally {
        setSyncLoading(false);
      }
    };
    reader.onerror = () => {
      setToast({ type: "error", message: "ไม่สามารถอ่านไฟล์ Excel ที่อัปโหลดได้" });
      setSyncLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // จัดการการเลือกกลุ่มสินค้า
  const selectExcelGroup = (group: ExcelProductGroup) => {
    setSelectedGroup(group);
    setDropdownOpen(false);
    setSearchQuery("");

    // Heuristics to extract attributes (options and sizes)
    const sizes = Array.from(new Set(group.items.map(item => item.size).filter(Boolean))) as string[];
    const options = Array.from(new Set(group.items.map(item => cleanVariantValue(item.onlineName, item.size, item.brand)).filter(Boolean))) as string[];

    // 1. ตั้งชื่อสินค้าหลักแบบละเอียด (ชื่อสินค้า ออนไลน์ + สีทุกสี + ขนาดทุกขนาด) ตามความต้องการของผู้ใช้เพื่อให้ AI ทำงานได้ดีที่สุด
    const baseOnlineName = group.items[0]?.onlineName || group.groupName;
    const colorStr = options.length > 0 ? ` สี ${options.join(", ")}` : "";
    const sizeStr = sizes.length > 0 ? ` ขนาด ${sizes.join(", ")}` : "";
    const detailedProductName = `${baseOnlineName}${colorStr}${sizeStr}`;
    
    setProductName(detailedProductName);

    // 2. ตั้งค่าน้ำหนักเฉลี่ย (แปลงเป็นกิโลกรัม)
    setWeight(String(group.avgWeightKg));

    // 3. ดึงคำอธิบายทางการจากชีต 2
    const firstItemWithDesc = group.items.find(item => item.description && item.description.trim() !== "");
    const baseDesc = firstItemWithDesc?.description || "ผลิตภัณฑ์คุณภาพสูง คัดสรรพิเศษเพื่อคุณ";

    setAiContent({
      tiktok_title: detailedProductName,
      description: baseDesc,
      market_price_analysis: `ราคาคู่แข่งออนไลน์ในกลุ่มนี้มีค่าเฉลี่ยประมาณ ${Math.min(...group.items.map(i => i.onlinePrice))} - ${Math.max(...group.items.map(i => i.onlinePrice))} บาท`
    });

    // 4. แยกลักษณะและค่าตัวเลือกสินค้าโดย Heuristics
    const newAttributes: VariantAttribute[] = [];
    if (options.length > 0) {
      newAttributes.push({ name: "Color/Option", values: options });
    }
    if (sizes.length > 0) {
      newAttributes.push({ name: "Size", values: sizes });
    }

    if (newAttributes.length === 0) {
      newAttributes.push({ name: "สูตร", values: ["มาตรฐาน"] });
    }

    setAttributes(newAttributes);
    
    // รีเซ็ตรูปภาพของกลุ่มย่อยเก่าออกเพื่อกันความสับสน
    setVariantImages({});
    
    setToast({ type: "info", message: `เชื่อมโยงกลุ่มสินค้า "${group.groupName}" สำเร็จ และสแกนพบ ${group.items.length} รายการย่อย` });
  };

  // จัดการบันทึกสถานะเสร็จสิ้นลงใน LocalStorage
  const toggleCompletedStatus = (groupName: string) => {
    let updated: string[];
    if (completedGroups.includes(groupName)) {
      updated = completedGroups.filter(g => g !== groupName);
      setToast({ type: "info", message: `เปลี่ยนสถานะกลุ่มสินค้าเป็น "รอดำเนินการ"` });
    } else {
      updated = [...completedGroups, groupName];
      setToast({ type: "success", message: `ทำเครื่องหมายกลุ่มสินค้าว่า "อัปโหลดเรียบร้อยแล้ว" ✅` });
    }
    setCompletedGroups(updated);
    localStorage.setItem("tiktok_completed_groups", JSON.stringify(updated));
  };

  // --- คำนวณตาราง Variant Cartesian Matrix ร่วมกับ Excel ---
  useEffect(() => {
    const combinations = getCartesianProduct(attributes);
    const attrOrder = attributes
      .filter((a) => a.name.trim() !== "" && a.values.length > 0)
      .map((a) => a.name.trim());

    const updatedRows: SkuRow[] = combinations.map((combo, idx) => {
      const comboKey = Object.values(combo).join("-");
      
      // ค่ามาตรฐานเริ่มต้น
      let generatedSku = generateSkuString(skuPrefix, combo, attrOrder);
      let price = "199";
      let stock = "100";

      // หากมีการเลือกข้อมูลจาก Excel ให้จับคู่รายการย่อยเพื่อเอาค่าจริงมาใช้!
      if (selectedGroup) {
        const matchedItem = selectedGroup.items.find(item => {
          const itemColor = cleanVariantValue(item.onlineName, item.size, item.brand);
          const itemSize = item.size;

          const colorMatch = !combo["Color/Option"] || combo["Color/Option"] === itemColor;
          const sizeMatch = !combo["Size"] || combo["Size"] === itemSize;

          return colorMatch && sizeMatch;
        });

        if (matchedItem) {
          // ใช้รหัส Item Code ของบริษัทเป็น Seller SKU ในชีตเพื่อความถูกต้องในการจับคู่ระบบคลัง
          generatedSku = matchedItem.code;
          price = String(pricingMode === "online" ? matchedItem.onlinePrice : matchedItem.rspPrice);
          stock = "100";
        }
      }

      // ตรวจสอบว่าผู้ใช้เคยแก้ไขราคารายเซลล์ในช่องพรีวิวด้วยตนเองหรือไม่
      const existingRow = skuRows.find(
        (r) => Object.values(r.combination).join("-") === comboKey
      );

      return {
        id: `row-${idx}`,
        combination: combo,
        price: existingRow?.price && existingRow.sku === generatedSku ? existingRow.price : price,
        stock: existingRow?.stock || stock,
        sku: generatedSku
      };
    });

    setSkuRows(updatedRows);
  }, [attributes, skuPrefix, selectedGroup, pricingMode]);

  // คืนค่าหน่วยความจำ Object URLs
  useEffect(() => {
    return () => {
      mainImages.forEach((img) => URL.revokeObjectURL(img.preview));
      Object.values(variantImages).forEach((vImg) => URL.revokeObjectURL(vImg.preview));
    };
  }, []);

  // --- ฟังก์ชันอัปโหลดรูปภาพหลัก ---
  const handleMainImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    const newImages = filesArray.map((file) => {
      const id = Math.random().toString(36).substring(2, 9);
      const preview = URL.createObjectURL(file);
      return { id, file, preview, processed: null };
    });

    setMainImages((prev) => [...prev, ...newImages]);
    setToast({ type: "info", message: `เพิ่มรูปภาพสินค้าหลักแล้ว ${filesArray.length} รูป` });
  };

  const removeMainImage = (id: string, previewUrl: string) => {
    setMainImages((prev) => prev.filter((img) => img.id !== id));
    URL.revokeObjectURL(previewUrl);
  };

  // --- ฟังก์ชันอัปโหลดไฟล์โลโก้ ---
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setToast({ type: "success", message: "อัปโหลดโลโก้ร้านค้าเรียบร้อยแล้ว" });
    }
  };

  // --- ฟังก์ชันอัปโหลดรูปภาพตัวเลือกสินค้าเฉพาะสี ---
  const handleVariantImageUpload = (colorValue: string, file: File) => {
    const preview = URL.createObjectURL(file);
    if (variantImages[colorValue]) {
      URL.revokeObjectURL(variantImages[colorValue].preview);
    }

    setVariantImages((prev) => ({
      ...prev,
      [colorValue]: { file, preview, processed: null }
    }));
  };

  // --- การตั้งค่าคุณลักษณะตัวเลือกเพิ่มเติม ---
  const addAttribute = () => {
    if (attributes.length >= 3) {
      setToast({ type: "error", message: "TikTok Shop รองรับคุณลักษณะสินค้าสูงสุด 3 รายการเท่านั้น" });
      return;
    }
    setAttributes((prev) => [...prev, { name: "", values: [] }]);
  };

  const removeAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAttributeName = (index: number, name: string) => {
    setAttributes((prev) => {
      const updated = [...prev];
      updated[index].name = name;
      return updated;
    });
  };

  const updateAttributeValues = (index: number, valuesString: string) => {
    const valuesArray = valuesString.split(",").map((v) => v.trim()).filter((v) => v !== "");
    setAttributes((prev) => {
      const updated = [...prev];
      updated[index].values = valuesArray;
      return updated;
    });
  };

  const handleMatrixCellChange = (rowId: string, field: "price" | "stock", value: string) => {
    setSkuRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  // --- ฟังก์ชันประมวลผลใส่กรอบรูปภาพสินค้าอัตโนมัติ ---
  const processAllImages = async (): Promise<boolean> => {
    if (mainImages.length === 0) {
      setToast({ type: "error", message: "กรุณาอัปโหลดรูปภาพสินค้าหลักอย่างน้อย 1 รูป" });
      return false;
    }

    setProcessingImages(true);
    try {
      const brandingOpts: BrandingOptions = {
        aspectMode,
        backgroundColor,
        frameStyle,
        frameColor,
        logoFile,
        logoText,
        logoScale,
        customFrameFile
      };

      // ใส่กรอบภาพหลักแบบขนาน
      const updatedMain = await Promise.all(
        mainImages.map(async (img) => {
          const base64Str = await processBrandedImage(img.preview, brandingOpts);
          return { ...img, processed: base64Str };
        })
      );
      setMainImages(updatedMain);

      // ใส่กรอบภาพตัวเลือกสินค้าเฉพาะสี
      const updatedVariants: Record<string, { file: File; preview: string; processed: string | null }> = {};
      await Promise.all(
        Object.entries(variantImages).map(async ([colorVal, details]) => {
          const base64Str = await processBrandedImage(details.preview, brandingOpts);
          updatedVariants[colorVal] = { ...details, processed: base64Str };
        })
      );
      setVariantImages(updatedVariants);

      setToast({ type: "success", message: "ใส่กรอบรูปภาพสินค้าและโลโก้แบรนด์สำเร็จแล้วทุกรูป!" });
      return true;
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `เกิดข้อผิดพลาดในการใส่กรอบรูปภาพ: ${err.message || err}` });
      return false;
    } finally {
      setProcessingImages(false);
    }
  };

  // --- ฟังก์ชันสร้างคำโปรยด้วย AI Gemini ---
  const generateAiContent = async () => {
    if (!productName.trim()) {
      setToast({ type: "error", message: "กรุณาระบุชื่อสินค้าหลักเพื่อเริ่มต้นสร้างข้อมูลด้วย AI" });
      return;
    }

    setAiLoading(true);
    setAiContent(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI Server");
      }

      setAiContent(data);
      setToast({ type: "success", message: "สร้างข้อมูลสินค้าและชื่อหลัก optimized สำหรับ TikTok แล้ว!" });
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `AI ทำงานล้มเหลว: ${err.message || err}` });
    } finally {
      setAiLoading(false);
    }
  };

  // --- ฟังก์ชันส่งออกแพ็กเกจ Bulk Upload ZIP & Excel ---
  const triggerPackageExport = async () => {
    if (!productName.trim()) {
      setToast({ type: "error", message: "กรุณาระบุชื่อสินค้าหลักก่อนดำเนินการส่งออกไฟล์" });
      return;
    }

    let ok = true;
    const firstMain = mainImages[0];
    if (!firstMain || !firstMain.processed) {
      ok = await processAllImages();
    }

    if (!ok) return;

    setExportLoading(true);
    try {
      const activeMainProcessed = mainImages.map((img) => img.processed).filter(Boolean) as string[];
      const activeVariantProcessed: Record<string, string> = {};
      Object.entries(variantImages).forEach(([colorVal, details]) => {
        if (details.processed) {
          activeVariantProcessed[colorVal] = details.processed;
        }
      });

      const exportPayload = {
        excelData: {
          productName: aiContent?.tiktok_title || productName,
          description: aiContent?.description || "สินค้าคุณภาพสูง ผ่านการคัดสรรมาเป็นอย่างดี",
          weight: parseFloat(weight) || 0.25,
          length: parseFloat(length) || 15,
          width: parseFloat(width) || 15,
          height: parseFloat(height) || 10,
          attributes: attributes,
          skuRows: skuRows,
          mainImagesCount: activeMainProcessed.length
        },
        mainImages: activeMainProcessed,
        variantImages: activeVariantProcessed
      };

      await exportTikTokMassUploadPackage(exportPayload);
      
      // มาร์กกลุ่มสินค้าเสร็จสิ้นในความจำ
      if (selectedGroup) {
        const groupName = selectedGroup.groupName;
        if (!completedGroups.includes(groupName)) {
          const updated = [...completedGroups, groupName];
          setCompletedGroups(updated);
          localStorage.setItem("tiktok_completed_groups", JSON.stringify(updated));
        }
      }

      setToast({ type: "success", message: "ส่งออกแพ็กเกจลงทะเบียนสินค้าสำเร็จแล้ว (ไฟล์ ZIP/Excel)!" });
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `ส่งออกไฟล์ล้มเหลว: ${err.message || err}` });
    } finally {
      setExportLoading(false);
    }
  };

  // รวบรวมรูปภาพพรีวิว
  const allPreviewImages: Array<{ title: string; src: string }> = [];
  mainImages.forEach((img, idx) => {
    if (img.processed) {
      allPreviewImages.push({ title: `ภาพสินค้าหลักที่ ${idx + 1}`, src: img.processed });
    }
  });
  Object.entries(variantImages).forEach(([colorVal, details]) => {
    if (details.processed) {
      allPreviewImages.push({ title: `ภาพสีตัวเลือกย่อย (${colorVal})`, src: details.processed });
    }
  });

  const firstAttr = attributes[0];
  const isColorAttribute = firstAttr && (firstAttr.name.toLowerCase().includes("color") || firstAttr.name.toLowerCase().includes("สี") || firstAttr.name.toLowerCase().includes("option"));
  const colorVariantValues = isColorAttribute ? firstAttr.values : [];

  // การกรองกลุ่มสินค้าตามการสืบค้น
  const filteredGroups = productGroups.filter(g => 
    g.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#334155] font-sans pb-24 selection:bg-orange-500 selection:text-white">
      
      {/* ระบบปิดแจ้งเตือน Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg backdrop-blur-xl transition-all duration-300 transform translate-y-0 ${
          toast.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : toast.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : "bg-slate-50 border-slate-200 text-slate-800"
        }`}>
          {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-600" />}
          {toast.type === "error" && <AlertCircle className="w-5 h-5 text-rose-600" />}
          {toast.type === "info" && <Info className="w-5 h-5 text-indigo-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* ส่วนหัวของเว็บไซต์พรีวิวขาว (Header Style Premium Light) */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                เครื่องมือเตรียมอัปโหลดสินค้า TikTok Shop
                <span className="text-[10px] uppercase font-bold bg-indigo-50 border border-indigo-150 text-indigo-600 px-2 py-0.5 rounded-full">
                  พรีเมียม AI v2.1
                </span>
              </h1>
              <p className="text-xs text-slate-500">ระบบอัตโนมัติเชื่อมโยงฐานข้อมูล Excel, ใส่กรอบแบรนด์ และวิเคราะห์สินค้าด้วย AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {excelModifiedDate && (
              <span className="text-slate-500 hidden sm:inline">
                📅 อัปเดต Excel ล่าสุด: <strong className="text-slate-700">{excelModifiedDate}</strong>
              </span>
            )}
            <span className="text-slate-400">LAN: <strong className="text-orange-600">192.168.1.221</strong></span>
          </div>
        </div>
      </header>

      {/* บล็อกแผงควบคุมหลักเต็มหน้าจอ (Excel integration center) */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 border-l-4 border-l-orange-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-sm uppercase tracking-widest font-bold text-orange-600 flex items-center gap-2 mb-1">
                <Settings className="w-4 h-4" /> 📦 เชื่อมโยงฐานข้อมูลรายการสินค้า Excel รายเดือน
              </h2>
              <p className="text-xs text-slate-500">
                เลือกสินค้าจากตาราง Excel ของบริษัท ระบบจะดึงรายละเอียดสินค้า ค้นหาขนาด จัดกลุ่มย่อย และตั้งราคาขายให้อัตโนมัติ
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => fetchProductGroups(true)}
                disabled={syncLoading}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-350 hover:bg-slate-50 bg-white cursor-pointer text-xs font-bold text-slate-700 transition shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${syncLoading ? "animate-spin" : ""}`} />
                {syncLoading ? "กำลังแกะข้อมูล Excel..." : "อัปเดตข้อมูลจากเซิร์ฟเวอร์"}
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 cursor-pointer text-xs font-bold transition shadow-sm hover:border-indigo-350">
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                อัปโหลดไฟล์ Excel เอง (.xlsx)
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
            {/* คอลัมน์ที่ 1: ค้นหาและเลือกสินค้า (Search Dropdown) */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-slate-650 mb-2">เลือกสินค้าจาก Excel*</label>
              
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100/50 transition text-left focus:outline-none"
              >
                <span className="truncate flex items-center gap-2">
                  {selectedGroup ? (
                    <>
                      {completedGroups.includes(selectedGroup.groupName) ? (
                        <span className="text-emerald-600 text-xs font-bold">✅</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                      )}
                      <strong className="text-slate-800">{selectedGroup.groupName}</strong>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {selectedGroup.items.length} รายการ
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">--- เลือกสินค้ายี่ห้อและสูตร ---</span>
                  )}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-3 duration-200 max-h-80 overflow-y-auto">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อสินค้า หรือแบรนด์..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-orange-500 text-slate-700 bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-1">
                    {filteredGroups.length > 0 ? (
                      filteredGroups.map((group) => {
                        const isDone = completedGroups.includes(group.groupName);
                        const hasPriceChange = group.items.some(i => i.hasPriceChange);
                        return (
                          <button
                            key={group.groupName}
                            onClick={() => selectExcelGroup(group)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition ${
                              selectedGroup?.groupName === group.groupName
                                ? "bg-orange-50 text-orange-850 font-bold"
                                : "hover:bg-slate-50 text-slate-700 font-semibold"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5 truncate pr-2">
                              <span className="truncate flex items-center gap-1.5">
                                {isDone && <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />}
                                {group.groupName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium font-sans">
                                แบรนด์: {group.brand} | ประเภท: {group.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {hasPriceChange && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> ราคาเปลี่ยน
                                </span>
                              )}
                              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold font-mono px-2 py-0.5 rounded">
                                {group.items.length} SKU
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-4 text-xs text-slate-400 font-medium">ไม่พบสินค้าที่คุณค้นหา</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* คอลัมน์ที่ 2: การเลือกราคาแนะนำขาย (Online vs RSP) */}
            <div>
              <label className="block text-xs font-bold text-slate-650 mb-2">เลือกราคาแนะนำขายหลัก</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setPricingMode("online")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    pricingMode === "online"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-750"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-indigo-500" /> ราคาขาย Online
                </button>
                <button
                  onClick={() => setPricingMode("rsp")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    pricingMode === "rsp"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-750"
                  }`}
                >
                  👑 RSP หัวเสือปกติ
                </button>
              </div>
            </div>

            {/* คอลัมน์ที่ 3: แสดงความคืบหน้ากลุ่มสินค้า */}
            {selectedGroup && (
              <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <div className="flex-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">สถานะกลุ่มนี้</span>
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${
                    completedGroups.includes(selectedGroup.groupName) ? "text-emerald-700" : "text-amber-700"
                  }`}>
                    {completedGroups.includes(selectedGroup.groupName) ? (
                      <>✅ ทำเสร็จสิ้นแล้ว</>
                    ) : (
                      <>⏳ รอดำเนินการ</>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => toggleCompletedStatus(selectedGroup.groupName)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                    completedGroups.includes(selectedGroup.groupName)
                      ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      : "bg-emerald-50 border-emerald-250 text-emerald-750 hover:bg-emerald-100"
                  }`}
                >
                  {completedGroups.includes(selectedGroup.groupName) ? "ตั้งเป็น รอดำเนินการ" : "มาร์กแบรนด์นี้ว่าทำแล้ว"}
                </button>
              </div>
            )}
          </div>

          {/* รายงานตรวจพบการเปลี่ยนแปลงราคาออนไลน์ประจำเดือน */}
          {priceChanges.length > 0 && (
            <div className="mt-6 p-4 border border-amber-250 bg-amber-50/30 rounded-xl">
              <h3 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" /> 🔔 รายงานตรวจสอบพบการเปลี่ยนแปลงราคาสินค้าประจำรอบเดือน!
              </h3>
              <p className="text-[10px] text-slate-500 mb-3 font-semibold leading-relaxed">
                ระบบได้ตรวจพบข้อมูลราคาสินค้าใน Excel รอบใหม่มีการเปลี่ยนแปลงเมื่อเทียบกับราคารอบก่อนหน้านี้ โปรดอัปเดตราคาใน TikTok Shop ของคุณ:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-32 overflow-y-auto pr-1">
                {priceChanges.map((change, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-white border border-slate-150 text-[10px] flex items-center justify-between shadow-inner">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-800 truncate block">{change.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">รหัสสินค้า: {change.itemCode} | {change.groupName}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-slate-400 font-mono">Online: </span>
                      <span className="text-rose-500 line-through font-mono">{change.oldOnline}฿</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="text-emerald-600 font-bold font-mono">{change.newOnline}฿</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* แผงควบคุมแบ่งซ้าย-ขวา */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ==================== แผงควบคุมซ้าย: สื่อและขอบภาพ ==================== */}
        <section className="space-y-8">
          
          {/* ส่วนอัปโหลดรูปหลัก (Main Image Uploader) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-indigo-500">
            <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-600 mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> 1. รูปภาพสินค้าหลัก
            </h2>

            <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition duration-300">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleMainImagesUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 shadow-sm">
                <Upload className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800">ลากและวางรูปภาพสินค้าที่นี่</p>
                <p className="text-xs text-slate-500 mt-1">รองรับไฟล์ PNG, JPG (แนะนำอย่างน้อย 3 รูปขึ้นไป)</p>
              </div>
            </label>

            {/* แสดงพรีวิวรูปภาพเล็ก */}
            {mainImages.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mt-6">
                {mainImages.map((img, idx) => (
                  <div key={img.id} className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-square shadow-sm">
                    <img
                      src={img.processed || img.preview}
                      alt={`upload-${idx}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                      <button
                        onClick={() => removeMainImage(img.id, img.preview)}
                        className="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/95 border border-slate-200 text-slate-700 shadow-sm">
                      #{idx + 1} {img.processed ? "ใส่กรอบแล้ว" : "ภาพดิบ"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ส่วนการใส่ขอบแบรนด์ร้านค้า (Branding Engine) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-orange-500">
            <h2 className="text-sm uppercase tracking-widest font-bold text-orange-600 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> 2. ตั้งค่ากรอบแบรนด์ร้านค้า (Branding Engine)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* โหมดจัดสัดส่วนภาพ */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">โหมดปรับสัดส่วนภาพ</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAspectMode("contain")}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      aspectMode === "contain"
                        ? "bg-orange-50 border-orange-500/60 text-orange-700 font-bold"
                        : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    ขอบนอกเต็ม (Contain)
                  </button>
                  <button
                    onClick={() => setAspectMode("cover")}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition ${
                      aspectMode === "cover"
                        ? "bg-orange-50 border-orange-500/60 text-orange-700 font-bold"
                        : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                    }`}
                  >
                    ครอบสี่เหลี่ยม (Cover)
                  </button>
                </div>
              </div>

              {/* สีพื้นหลังขอบส่วนเกิน */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">สีพื้นหลังของขอบส่วนเกิน</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-10 h-10 p-0 rounded-lg bg-transparent border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-700"
                  />
                </div>
              </div>

              {/* สไตล์ของกรอบเรขาคณิต */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">รูปแบบกรอบลายเรขาคณิต</label>
                <select
                  value={frameStyle}
                  onChange={(e) => setFrameStyle(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-700"
                >
                  <option value="none">ไม่มีกรอบ</option>
                  <option value="minimalist-corners">ขอบมุมมินิมอลแบบเรืองแสง</option>
                  <option value="elegant-double">ขอบคู่แบบหรูหรา</option>
                  <option value="clean-border">ขอบทึบสไตล์โมเดิร์น</option>
                  <option value="custom-image">อัปโหลดกรอบรูปแบรนด์ส่วนตัว (.png)</option>
                </select>
              </div>

              {/* สีกรอบภาพ */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">สีของกรอบภาพ</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    disabled={frameStyle === "custom-image"}
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="w-10 h-10 p-0 rounded-lg bg-transparent border border-slate-200 cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    disabled={frameStyle === "custom-image"}
                    value={frameStyle === "custom-image" ? "ใช้กรอบรูปภาพแบรนดิ้ง" : frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* ช่องอัปโหลดไฟล์กรอบรูปภาพแบรนด์ส่วนตัว PNG */}
              {frameStyle === "custom-image" && (
                <div className="md:col-span-2 p-4 rounded-xl border border-orange-200 bg-orange-50/20">
                  <label className="block text-xs font-bold text-orange-700 mb-2">อัปโหลดไฟล์กรอบรูปภาพแบรนด์ของคุณ (ไฟล์ PNG โปร่งแสง ขนาด 1:1 แนะนำ 1000x1000px)</label>
                  <div className="flex gap-3 items-center">
                    <label className="px-4 py-2.5 rounded-lg border border-orange-200 hover:bg-orange-50 bg-white cursor-pointer text-xs font-bold text-orange-700 text-center flex-1 transition shadow-sm">
                      เลือกไฟล์กรอบภาพ PNG
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setCustomFrameFile(e.target.files[0]);
                            setToast({ type: "success", message: "อัปโหลดไฟล์กรอบรูปแบรนด์ส่วนตัวเรียบร้อยแล้ว" });
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {customFrameFile ? (
                      <div className="text-xs text-emerald-600 flex items-center gap-1.5 font-bold">
                        <CheckCircle className="w-4 h-4" /> {customFrameFile.name}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-semibold">ยังไม่ได้เลือกไฟล์กรอบรูป</span>
                    )}
                  </div>
                </div>
              )}

              {/* ข้อความโลโก้แบบกล่อง */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">ข้อความบนโลโก้แบรนด์ (สำหรับโลโก้แบบกล่องข้อความ)</label>
                <input
                  type="text"
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-700 font-semibold"
                  placeholder="ตัวอย่าง MAVINTAE"
                />
              </div>

              {/* อัปโหลดรูปโลโก้ PNG */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">อัปโหลดไฟล์โลโก้แบรนด์ของคุณ (ไฟล์ PNG โปร่งแสง)</label>
                <div className="flex gap-3 items-center">
                  <label className="px-3 py-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-700 text-center flex-1 transition shadow-sm">
                    เลือกไฟล์โลโก้ PNG
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {logoFile ? (
                    <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" /> โลโก้พร้อมใช้งาน
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">ใช้ข้อความกล่องแทน</span>
                  )}
                </div>
              </div>

              {/* แถบเลื่อนขยายโลโก้ */}
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-600">ตัวคูณปรับขนาดโลโก้: {logoScale}x</label>
                  <span className="text-[10px] text-slate-400 font-medium">ระบบปรับขนาดอัตโนมัติตามสัดส่วนภาพ 1000x1000px</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={logoScale}
                  onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </div>

          {/* การตั้งค่าคุณลักษณะตัวเลือกย่อย (Variants) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-indigo-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-600 flex items-center gap-2">
                <Layers className="w-4 h-4" /> 3. ตั้งค่าคุณลักษณะตัวเลือกสินค้า (Variants)
              </h2>
              <button
                onClick={addAttribute}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs border border-indigo-200 transition font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> เพิ่มตัวเลือก
              </button>
            </div>

            <div className="space-y-4">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex gap-4 items-start p-4 rounded-xl border border-slate-100 bg-slate-50/50 relative">
                  <div className="w-1/3">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">ชื่อตัวเลือกสินค้า</label>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttributeName(idx, e.target.value)}
                      placeholder="ตัวอย่าง สี"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-semibold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">ค่าตัวเลือกย่อย (คั่นด้วยเครื่องหมายจุลภาค , )</label>
                    <input
                      type="text"
                      value={attr.values.join(", ")}
                      onChange={(e) => updateAttributeValues(idx, e.target.value)}
                      placeholder="ตัวอย่าง ดำ, ขาว"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-700 font-semibold"
                    />
                  </div>
                  <button
                    onClick={() => removeAttribute(idx)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 mt-5 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* ช่องใส่รูปภาพย่อยผูกสีพิเศษ */}
            {colorVariantValues.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-orange-500" /> ช่องรูปภาพตัวเลือกสินค้าเฉพาะสี (รูปจะผูกตามแต่ละสี)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {colorVariantValues.map((val) => {
                    const savedItem = variantImages[val];
                    return (
                      <div key={val} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-2 items-center text-center justify-between relative shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-2 py-0.5 bg-white rounded border border-slate-150">
                          {val}
                        </span>

                        <label className="w-full flex flex-col items-center justify-center aspect-video border border-dashed border-slate-300 hover:border-indigo-500 rounded-lg p-2 cursor-pointer transition bg-white relative overflow-hidden group shadow-inner">
                          {savedItem ? (
                            <>
                              <img
                                src={savedItem.processed || savedItem.preview}
                                alt={val}
                                className="w-full h-full object-cover rounded"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[9px] font-bold text-white">เปลี่ยนรูปภาพ</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-slate-400 mb-1" />
                              <span className="text-[9px] text-slate-500 font-bold">อัปโหลดรูป {val}</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleVariantImageUpload(val, e.target.files[0]);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ==================== แผงควบคุมขวา: ข้อมูล AI และ ตาราง SKU ==================== */}
        <section className="space-y-8">
          
          {/* ข้อมูลสัดส่วนและน้ำหนักสินค้า (Dimensions Card) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-indigo-500">
            <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-600 mb-4 flex items-center gap-2">
              <Ruler className="w-4 h-4" /> 4. ขนาดและสัดส่วนน้ำหนักสินค้า
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">ชื่อสินค้าหลัก*</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="ตัวอย่าง เซรั่มบำรุงผิวหน้า Niacinamide เข้มข้น 10%"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-semibold shadow-inner"
                  />
                  <button
                    onClick={generateAiContent}
                    disabled={aiLoading}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 disabled:text-slate-200 text-xs font-bold text-white shadow-md transition"
                  >
                    {aiLoading ? (
                      <span className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Sparkles className="w-4 h-4 text-orange-300" />
                    )}
                    สร้างข้อมูลด้วย AI
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">น้ำหนัก (กก.)</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-right text-slate-700 font-semibold shadow-inner focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">ความยาว (ซม.)</label>
                <input
                  type="text"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-right text-slate-700 font-semibold shadow-inner focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">ความกว้าง (ซม.)</label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-right text-slate-700 font-semibold shadow-inner focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">ความสูง (ซม.)</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-right text-slate-700 font-semibold shadow-inner focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* รายละเอียดแนะนำโดย AI (Gemini Panel) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-orange-500">
            <h2 className="text-sm uppercase tracking-widest font-bold text-orange-600 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 5. รายละเอียดสินค้า
            </h2>

            {aiContent ? (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">ชื่อสินค้าแนะนำเพื่อเพิ่มการค้นหา (SEO)</label>
                    <span className="text-[9px] text-slate-400 font-mono">({aiContent.tiktok_title.length} ตัวอักษร)</span>
                  </div>
                  <input
                    type="text"
                    value={aiContent.tiktok_title}
                    onChange={(e) => setAiContent({ ...aiContent, tiktok_title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-indigo-50/50 border border-indigo-150 text-xs text-indigo-700 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">รายละเอียดสินค้า (แบ่งเป็นหัวข้ออ่านง่าย)</label>
                  <textarea
                    rows={12}
                    value={aiContent.description}
                    onChange={(e) => setAiContent({ ...aiContent, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed focus:outline-none font-sans font-semibold"
                  />
                </div>

                {aiContent.market_price_analysis && (
                  <div className="p-3.5 rounded-xl border border-orange-100 bg-orange-50/40 text-slate-700">
                    <div className="flex items-center gap-1.5 text-xs text-orange-600 font-bold mb-1">
                      <Info className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> ข้อมูลราคาสินค้าแนะนํา
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">{aiContent.market_price_analysis}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 border border-slate-200 border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-2">
                <Sparkles className="w-8 h-8 text-slate-400 mb-1" />
                <p className="text-xs text-slate-500 font-bold">ยังไม่มีข้อมูลสินค้า</p>
                <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">เลือกเชื่อมโยงข้อมูล Excel ด้านบน หรือระบุชื่อสินค้าแล้วคลิก "สร้างข้อมูลด้วย AI"</p>
              </div>
            )}
          </div>

          {/* ตาราง variant SKU matrix (Combinations) */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 relative overflow-hidden border-l-4 border-l-indigo-500">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
              <div>
                <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-600 flex items-center gap-2">
                  <Coins className="w-4 h-4" /> 6. ตารางกำหนดราคาและสต็อกรายตัวเลือก (Variant SKU Matrix)
                </h2>
                <p className="text-[10px] text-slate-400">ตารางแสดงการจับคู่สินค้าทุกตัวเลือก จะอัปเดตให้อัตโนมัติเมื่อค่าด้านบนเปลี่ยนแปลง</p>
              </div>

              <div className="flex gap-2 items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">คำนำหน้า SKU:</span>
                <input
                  type="text"
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value)}
                  placeholder="ตัวอย่าง BRAND"
                  className="w-16 px-2 py-1 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-800 focus:outline-none text-center shadow-sm"
                />
              </div>
            </div>

            {skuRows.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="p-3 font-bold uppercase">รายการตัวเลือกย่อย</th>
                      <th className="p-3 font-bold uppercase">รหัส SKU ที่สร้างขึ้น</th>
                      <th className="p-3 font-bold uppercase w-20">ราคา (บาท)*</th>
                      <th className="p-3 font-bold uppercase w-20">สต็อกสินค้า*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuRows.map((row) => {
                      const comboStr = Object.entries(row.combination)
                        .map(([k, v]) => `${v}`)
                        .join(" - ");

                      // ตรวจสอบราคาในอดีต (หากมี) เพื่อรายงานราคาที่แตกต่าง
                      let previousPriceLabel = "";
                      if (selectedGroup) {
                        const matchedItem = selectedGroup.items.find(item => item.code === row.sku);
                        if (matchedItem && matchedItem.hasPriceChange) {
                          // ดึงประวัติราคารอบที่แล้ว
                          const hist = priceChanges.find(c => c.itemCode === row.sku);
                          if (hist) {
                            const oldPrice = pricingMode === "online" ? hist.oldOnline : hist.oldRsp;
                            const newPrice = pricingMode === "online" ? hist.newOnline : hist.newRsp;
                            if (oldPrice !== newPrice) {
                              previousPriceLabel = `เดิม: ${oldPrice}฿`;
                            }
                          }
                        }
                      }

                      return (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 text-slate-900 font-bold">
                            <span className="flex items-center gap-1">
                              {comboStr}
                              {previousPriceLabel && (
                                <span className="text-[8px] bg-rose-50 border border-rose-200 text-rose-600 px-1 py-0.5 rounded font-mono font-bold animate-pulse">
                                  ราคาอัปเดต
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono font-semibold">{row.sku}</td>
                          <td className="p-3 relative">
                            <input
                              type="text"
                              value={row.price}
                              onChange={(e) => handleMatrixCellChange(row.id, "price", e.target.value)}
                              className={`w-full px-2 py-1 rounded bg-white border text-right focus:outline-none focus:border-indigo-500 text-emerald-600 font-bold shadow-inner ${
                                previousPriceLabel ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
                              }`}
                            />
                            {previousPriceLabel && (
                              <span className="absolute right-3 -bottom-0.5 text-[8px] text-slate-400 font-mono scale-90 block">
                                {previousPriceLabel}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.stock}
                              onChange={(e) => handleMatrixCellChange(row.id, "stock", e.target.value)}
                              className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-right focus:outline-none focus:border-indigo-500 text-slate-700 font-bold shadow-inner"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 border border-slate-200 border-dashed rounded-xl flex items-center justify-center text-center text-xs text-slate-400 font-semibold">
                ระบุตัวเลือกย่อยและคุณลักษณะด้านบนเพื่อสร้างตารางรายการจับคู่ราคา
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ==================== แถบสติ๊กกี้ด้านล่างสำหรับการส่งออก (Footer Light) ==================== */}
      <footer className="fixed bottom-0 left-0 w-full bg-white/95 border-t border-slate-200 py-4 px-6 z-40 shadow-[0_-4px_12px_-5px_rgba(0,0,0,0.08)] backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-500 font-semibold">
              อัปโหลดภาพหลักแล้ว: <strong className="text-slate-800">{mainImages.length} รูป</strong> |{" "}
              ผูกรูปภาพตัวเลือกแล้ว: <strong className="text-slate-800">{Object.keys(variantImages).length} ช่อง</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* ปุ่มทำภาพ 1:1 */}
            <button
              onClick={processAllImages}
              disabled={processingImages || mainImages.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold transition disabled:opacity-50"
            >
              {processingImages ? (
                <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Settings className="w-4 h-4" />
              )}
              ⚙️ [ปรับภาพ 1:1 และใส่กรอบแบรนด์]
            </button>

            {/* ปุ่มดูพรีวิวรูปใส่กรอบ */}
            <button
              onClick={() => {
                if (allPreviewImages.length === 0) {
                  setToast({ type: "error", message: "กรุณากดปุ่ม ⚙️ [ปรับภาพ 1:1 และใส่กรอบแบรนด์] ก่อนเพื่อประมวลผลรูปภาพ" });
                  return;
                }
                setActivePreviewIndex(0);
                setPreviewOpen(true);
              }}
              disabled={allPreviewImages.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              👁️ [ดูตัวอย่างรูปใส่กรอบ]
            </button>

            {/* ปุ่มส่งออกไฟล์หลัก Excel / ZIP */}
            <button
              onClick={triggerPackageExport}
              disabled={exportLoading || mainImages.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-xs font-bold text-white shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition duration-300"
            >
              {exportLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Download className="w-4 h-4" />
              )}
              📥 [ส่งออกไฟล์สำหรับอัปโหลด TikTok Shop]
            </button>
          </div>
        </div>
      </footer>

      {/* ==================== โมดอลสำหรับแสดงตัวอย่างภาพที่ใส่กรอบ ==================== */}
      {previewOpen && allPreviewImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl p-6 relative flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 transition font-bold"
            >
              ✕
            </button>

            {/* ส่วนแสดงสไลด์ภาพ */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="aspect-square w-full max-w-[450px] border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center relative shadow-inner">
                <img
                  src={allPreviewImages[activePreviewIndex].src}
                  alt={allPreviewImages[activePreviewIndex].title}
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-slate-200 text-orange-600 font-bold px-3 py-1 rounded-lg text-xs shadow-sm">
                  {allPreviewImages[activePreviewIndex].title}
                </span>
                <span className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 text-slate-500 font-mono text-[10px] px-2 py-0.5 rounded shadow-sm">
                  สัดส่วน 1000 x 1000 px (1:1)
                </span>
              </div>
            </div>

            {/* แถบข้างเลือกรูปพรีวิว */}
            <div className="w-full md:w-60 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-orange-500" /> 👁️ ตัวอย่างภาพหลังจากใส่กรอบภาพ
                </h3>
                <p className="text-[10px] text-slate-500 mb-4 leading-relaxed font-medium">
                  กรุณาตรวจสอบความถูกต้องของระยะเว้นกรอบภาพ โลโก้ และสัดส่วนภาพให้ครบถ้วนก่อนส่งออกไฟล์อัปโหลด
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {allPreviewImages.map((pImg, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePreviewIndex(idx)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition shadow-sm ${
                        activePreviewIndex === idx
                          ? "bg-orange-50 border-orange-300 text-orange-700 font-bold"
                          : "border-slate-150 hover:bg-slate-50 bg-white text-slate-500"
                      }`}
                    >
                      <img
                        src={pImg.src}
                        className="w-8 h-8 rounded border border-slate-150 object-cover"
                      />
                      <span className="text-[10px] truncate flex-1 font-semibold">{pImg.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 mt-6">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md transition"
                >
                  รูปภาพสวยงามพร้อมใช้งาน!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
