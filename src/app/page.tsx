"use client";

import React, { useState, useEffect } from "react";
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

  // ปิดแจ้งเตือนอัตโนมัติ
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- คำนวณตาราง Variant Cartesian Matrix ---
  useEffect(() => {
    const combinations = getCartesianProduct(attributes);
    const attrOrder = attributes
      .filter((a) => a.name.trim() !== "" && a.values.length > 0)
      .map((a) => a.name.trim());

    const updatedRows: SkuRow[] = combinations.map((combo, idx) => {
      const comboKey = Object.values(combo).join("-");
      const generatedSku = generateSkuString(skuPrefix, combo, attrOrder);

      const existingRow = skuRows.find(
        (r) => Object.values(r.combination).join("-") === comboKey
      );

      return {
        id: `row-${idx}`,
        combination: combo,
        price: existingRow?.price || "199",
        stock: existingRow?.stock || "100",
        sku: generatedSku
      };
    });

    setSkuRows(updatedRows);
  }, [attributes, skuPrefix]);

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
  const isColorAttribute = firstAttr && (firstAttr.name.toLowerCase().includes("color") || firstAttr.name.toLowerCase().includes("สี"));
  const colorVariantValues = isColorAttribute ? firstAttr.values : [];

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
                  พรีเมียม AI v2.0
                </span>
              </h1>
              <p className="text-xs text-slate-500">ระบบอัตโนมัติจัดรูปแบบภาพ 1:1, ใส่กรอบแบรนด์ และสร้างข้อมูลสินค้าด้วย AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>เครื่องหลัก LAN: <strong className="text-orange-600">192.168.1.221</strong></span>
          </div>
        </div>
      </header>

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
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-bold">ชื่อตัวเลือกสินค้า</label>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttributeName(idx, e.target.value)}
                      placeholder="ตัวอย่าง สี"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-semibold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-bold">ค่าตัวเลือกย่อย (คั่นด้วยเครื่องหมายจุลภาค , )</label>
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
              <Sparkles className="w-4 h-4" /> 5. ข้อมูลสินค้าสำหรับ TikTok Shop โดย AI (Gemini)
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
                    rows={4}
                    value={aiContent.description}
                    onChange={(e) => setAiContent({ ...aiContent, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed focus:outline-none font-sans font-semibold"
                  />
                </div>

                <div className="p-3.5 rounded-xl border border-orange-100 bg-orange-50/40 text-slate-700">
                  <div className="flex items-center gap-1.5 text-xs text-orange-600 font-bold mb-1">
                    <Info className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> ข้อมูลวิเคราะห์ราคาคู่แข่งในตลาดออนไลน์
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 font-medium">{aiContent.market_price_analysis}</p>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-slate-200 border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-2">
                <Sparkles className="w-8 h-8 text-slate-400 mb-1" />
                <p className="text-xs text-slate-500 font-bold">ยังไม่ได้สร้างข้อมูลสินค้าด้วย AI</p>
                <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">ระบุชื่อสินค้าหลักด้านบนแล้วคลิก "สร้างข้อมูลด้วย AI" ระบบจะดึงคำค้นหายอดนิยมมาสร้างชื่อและหัวข้อสินค้าให้อัตโนมัติ</p>
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

                      return (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 text-slate-900 font-bold">{comboStr}</td>
                          <td className="p-3 text-slate-500 font-mono font-semibold">{row.sku}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.price}
                              onChange={(e) => handleMatrixCellChange(row.id, "price", e.target.value)}
                              className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-right focus:outline-none focus:border-indigo-500 text-emerald-600 font-bold shadow-inner"
                            />
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
