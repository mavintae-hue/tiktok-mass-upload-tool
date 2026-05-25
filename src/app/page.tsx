"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

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
  ChevronRight,
  Info,
  CheckCircle,
  AlertCircle,
  ArrowRight,
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
  // --- Product Information ---
  const [productName, setProductName] = useState("");
  const [weight, setWeight] = useState("0.25");
  const [length, setLength] = useState("15");
  const [width, setWidth] = useState("15");
  const [height, setHeight] = useState("10");
  const [skuPrefix, setSkuPrefix] = useState("TK");

  // --- Dynamic Variant Configurations ---
  const [attributes, setAttributes] = useState<VariantAttribute[]>([
    { name: "Color", values: ["Black", "White"] },
    { name: "Size", values: ["S", "M", "L"] }
  ]);
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);

  // --- Media State ---
  const [mainImages, setMainImages] = useState<Array<{ id: string; file: File; preview: string; processed: string | null }>>([]);
  const [variantImages, setVariantImages] = useState<Record<string, { file: File; preview: string; processed: string | null }>>({});
  
  // --- Branding Configurations ---
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoText, setLogoText] = useState("STORE BRAND");
  const [logoScale, setLogoScale] = useState(1.0);
  const [aspectMode, setAspectMode] = useState<"cover" | "contain">("contain");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [frameStyle, setFrameStyle] = useState<BrandingOptions["frameStyle"]>("minimalist-corners");
  const [frameColor, setFrameColor] = useState("#FF4E00"); // Vibrant orange branding default

  // --- AI Gemini Content ---
  const [aiContent, setAiContent] = useState<{
    tiktok_title: string;
    description: string;
    market_price_analysis: string;
  } | null>(null);

  // --- Loading / Toast States ---
  const [aiLoading, setAiLoading] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // --- Preview Modal ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  // Trigger auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Cartesian SKU Row Generator Logic ---
  useEffect(() => {
    const combinations = getCartesianProduct(attributes);
    const attrOrder = attributes
      .filter((a) => a.name.trim() !== "" && a.values.length > 0)
      .map((a) => a.name.trim());

    // Merge combinations with existing row values to avoid losing user input
    const updatedRows: SkuRow[] = combinations.map((combo, idx) => {
      const comboKey = Object.values(combo).join("-");
      const generatedSku = generateSkuString(skuPrefix, combo, attrOrder);

      // Check if we already have this exact combination configured to preserve price/stock
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

  // Clean up Object URLs when component unmounts
  useEffect(() => {
    return () => {
      mainImages.forEach((img) => URL.revokeObjectURL(img.preview));
      Object.values(variantImages).forEach((vImg) => URL.revokeObjectURL(vImg.preview));
    };
  }, []);

  // --- Handler Functions ---

  // Main Image Upload Handler
  const handleMainImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    const newImages = filesArray.map((file) => {
      const id = Math.random().toString(36).substring(2, 9);
      const preview = URL.createObjectURL(file);
      return { id, file, preview, processed: null };
    });

    setMainImages((prev) => [...prev, ...newImages]);
    setToast({ type: "info", message: `Added ${filesArray.length} main product images.` });
  };

  const removeMainImage = (id: string, previewUrl: string) => {
    setMainImages((prev) => prev.filter((img) => img.id !== id));
    URL.revokeObjectURL(previewUrl);
  };

  // Store Logo Upload Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setToast({ type: "success", message: "Custom Store Logo uploaded." });
    }
  };

  // Color Variant Image Handler (Maps upload specifically to a Color value)
  const handleVariantImageUpload = (colorValue: string, file: File) => {
    const preview = URL.createObjectURL(file);
    
    // Revoke old URL if overwriting
    if (variantImages[colorValue]) {
      URL.revokeObjectURL(variantImages[colorValue].preview);
    }

    setVariantImages((prev) => ({
      ...prev,
      [colorValue]: { file, preview, processed: null }
    }));
  };

  // Add/Remove Variant Configuration Rows
  const addAttribute = () => {
    if (attributes.length >= 3) {
      setToast({ type: "error", message: "TikTok Shop supports up to 3 variant attributes." });
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

  // Update SKU Row Price/Stock Inputs
  const handleMatrixCellChange = (rowId: string, field: "price" | "stock", value: string) => {
    setSkuRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  // --- Trigger Image Processing Branding Engine ---
  const processAllImages = async (): Promise<boolean> => {
    if (mainImages.length === 0) {
      setToast({ type: "error", message: "Please upload at least one main product image." });
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
        logoScale
      };

      // Process main images
      const updatedMain = await Promise.all(
        mainImages.map(async (img) => {
          const base64Str = await processBrandedImage(img.preview, brandingOpts);
          return { ...img, processed: base64Str };
        })
      );
      setMainImages(updatedMain);

      // Process variant images
      const updatedVariants: Record<string, { file: File; preview: string; processed: string | null }> = {};
      await Promise.all(
        Object.entries(variantImages).map(async ([colorVal, details]) => {
          const base64Str = await processBrandedImage(details.preview, brandingOpts);
          updatedVariants[colorVal] = { ...details, processed: base64Str };
        })
      );
      setVariantImages(updatedVariants);

      setToast({ type: "success", message: "All images branded with corporate frames & logo successfully!" });
      return true;
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `Branding Engine error: ${err.message || err}` });
      return false;
    } finally {
      setProcessingImages(false);
    }
  };

  // --- Call Next.js Serverless Gemini API Route ---
  const generateAiContent = async () => {
    if (!productName.trim()) {
      setToast({ type: "error", message: "Please enter the Core Product Name to generate content." });
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
        throw new Error(data.error || "Failed to fetch from server API.");
      }

      setAiContent(data);
      setToast({ type: "success", message: "TikTok Shop SEO title and listing optimized by AI!" });
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `AI generation failed: ${err.message || err}` });
    } finally {
      setAiLoading(false);
    }
  };

  // --- Unified Package ZIP & Excel Download Export Action ---
  const triggerPackageExport = async () => {
    if (!productName.trim()) {
      setToast({ type: "error", message: "Please enter a Core Product Name before exporting." });
      return;
    }

    // Step 1: Ensure all images are processed
    let ok = true;
    const firstMain = mainImages[0];
    if (!firstMain || !firstMain.processed) {
      ok = await processAllImages();
    }

    if (!ok) return;

    setExportLoading(true);
    try {
      // Re-read latest states
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
          description: aiContent?.description || "High quality product.",
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
      setToast({ type: "success", message: "TikTok Shop Upload Package exported successfully (ZIP/Excel)!" });
    } catch (err: any) {
      console.error(err);
      setToast({ type: "error", message: `Export failure: ${err.message || err}` });
    } finally {
      setExportLoading(false);
    }
  };

  // Gather images for the Preview Modal
  const allPreviewImages: Array<{ title: string; src: string }> = [];
  mainImages.forEach((img, idx) => {
    if (img.processed) {
      allPreviewImages.push({ title: `Main Image ${idx + 1}`, src: img.processed });
    }
  });
  Object.entries(variantImages).forEach(([colorVal, details]) => {
    if (details.processed) {
      allPreviewImages.push({ title: `Variant (${colorVal})`, src: details.processed });
    }
  });

  // Check if first attribute is dynamic Color to render uploader slots
  const firstAttr = attributes[0];
  const isColorAttribute = firstAttr && (firstAttr.name.toLowerCase().includes("color") || firstAttr.name.toLowerCase().includes("สี"));
  const colorVariantValues = isColorAttribute ? firstAttr.values : [];

  return (
    <div className="min-h-screen bg-[#090D16] text-[#E2E8F0] font-sans pb-24 selection:bg-orange-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 transform translate-y-0 ${
          toast.type === "success" 
            ? "bg-emerald-950/85 border-emerald-500/35 text-emerald-300"
            : toast.type === "error"
            ? "bg-rose-950/85 border-rose-500/35 text-rose-300"
            : "bg-slate-900/85 border-slate-700/35 text-sky-300"
        }`}>
          {toast.type === "success" && <CheckCircle className="w-5 h-5" />}
          {toast.type === "error" && <AlertCircle className="w-5 h-5" />}
          {toast.type === "info" && <Info className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Hero Header */}
      <header className="border-b border-slate-800 bg-[#0B0F19]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-orange-500/10">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                TikTok Shop Mass Upload Tool
                <span className="text-[10px] uppercase font-semibold bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full">
                  v2.0 Premium
                </span>
              </h1>
              <p className="text-xs text-slate-400">Internal AI-Branding Automation Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <Link
              href="/gps-tracker"
              className="text-xs bg-slate-800/80 border border-slate-700 hover:bg-indigo-600/10 hover:border-indigo-500/50 px-3.5 py-2 rounded-xl transition duration-300 flex items-center gap-1.5 font-semibold text-slate-300 hover:text-indigo-400 shadow-md shadow-black/10"
            >
              🛰️ Sales GPS Tracker
            </Link>
            <div className="h-4 w-px bg-slate-800"></div>
            <span>Server Direct Route: <strong className="text-orange-400">192.168.1.221</strong></span>
          </div>

        </div>
      </header>

      {/* Main Split-Screen Dashboard Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ==================== LEFT PANEL: MEDIA & BRANDING ==================== */}
        <section className="space-y-8">
          
          {/* Main Media Uploader Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1524]/90 shadow-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-transparent"></div>
            <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-400 mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> 1. Main Product Media
            </h2>

            {/* Drag & Drop Main Zone */}
            <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-900/40 transition hover:bg-slate-900/60 duration-300">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleMainImagesUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">Drag & drop product images</p>
                <p className="text-xs text-slate-500 mt-1">Supports PNG, JPG (Recommend min. 3 images)</p>
              </div>
            </label>

            {/* Main Images Thumbnails */}
            {mainImages.length > 0 && (
              <div className="grid grid-cols-4 gap-4 mt-6">
                {mainImages.map((img, idx) => (
                  <div key={img.id} className="group relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 aspect-square">
                    <img
                      src={img.processed || img.preview}
                      alt={`upload-${idx}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                      <button
                        onClick={() => removeMainImage(img.id, img.preview)}
                        className="p-1.5 rounded-lg bg-rose-500/90 text-white hover:bg-rose-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-300">
                      #{idx + 1} {img.processed ? "Framed" : "Raw"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Corporate Image Branding Configuration */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1524]/90 shadow-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-transparent"></div>
            <h2 className="text-sm uppercase tracking-widest font-bold text-orange-400 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> 2. Corporate Branding Engine Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Aspect Ratio Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Aspect Scaling Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAspectMode("contain")}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition ${
                      aspectMode === "contain"
                        ? "bg-orange-500/10 border-orange-500/50 text-orange-400"
                        : "border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    Contain (Show Frame Padding)
                  </button>
                  <button
                    onClick={() => setAspectMode("cover")}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition ${
                      aspectMode === "cover"
                        ? "bg-orange-500/10 border-orange-500/50 text-orange-400"
                        : "border-slate-800 hover:border-slate-700 text-slate-400"
                    }`}
                  >
                    Cover (Crop to fill 1:1)
                  </button>
                </div>
              </div>

              {/* Background Color Pad */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Background Color Padding</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-10 h-10 p-0 rounded-lg bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-slate-700 text-slate-300"
                  />
                </div>
              </div>

              {/* Geometric Frame Styles */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Geometric Border Style</label>
                <select
                  value={frameStyle}
                  onChange={(e) => setFrameStyle(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-slate-700 text-slate-300"
                >
                  <option value="none">No Frame/Border</option>
                  <option value="minimalist-corners">Minimalist Corners (Glowing brackets)</option>
                  <option value="elegant-double">Elegant Double Border</option>
                  <option value="clean-border">Sleek Solid Border</option>
                </select>
              </div>

              {/* Frame Color */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Frame Border Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="w-10 h-10 p-0 rounded-lg bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-slate-700 text-slate-300"
                  />
                </div>
              </div>

              {/* Logo Badge Config */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Logo Text (Pill Badge default)</label>
                <input
                  type="text"
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-indigo-500 text-slate-300"
                  placeholder="e.g. MAVINTAE"
                />
              </div>

              {/* Store Logo File uploader */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Upload Store Logo File (Overlay PNG)</label>
                <div className="flex gap-3 items-center">
                  <label className="px-3 py-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 cursor-pointer text-xs font-semibold text-slate-300 text-center flex-1 transition">
                    Choose PNG File
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  {logoFile ? (
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" /> logo.png
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500">None (Pill Badge Active)</span>
                  )}
                </div>
              </div>

              {/* Logo scale multiplier */}
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-400">Logo Scale Multiplier: {logoScale}x</label>
                  <span className="text-[10px] text-slate-500">Auto fits relative to 1000x1000px layout</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={logoScale}
                  onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Variant Option Attributes Input Area */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1524]/90 shadow-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-transparent"></div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-400 flex items-center gap-2">
                <Layers className="w-4 h-4" /> 3. Dynamic Variation Settings
              </h2>
              <button
                onClick={addAttribute}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs border border-indigo-500/35 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Attribute
              </button>
            </div>

            <div className="space-y-4">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex gap-4 items-start p-4 rounded-xl border border-slate-850 bg-slate-900/40 relative">
                  {/* Name Input */}
                  <div className="w-1/3">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Attribute Name</label>
                    <input
                      type="text"
                      value={attr.name}
                      onChange={(e) => updateAttributeName(idx, e.target.value)}
                      placeholder="e.g. Color, Size"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-indigo-500 text-white font-medium"
                    />
                  </div>

                  {/* Values Input (Comma separated) */}
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Values (comma-separated list)</label>
                    <input
                      type="text"
                      value={attr.values.join(", ")}
                      onChange={(e) => updateAttributeValues(idx, e.target.value)}
                      placeholder="e.g. Black, White"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-indigo-500 text-slate-300 font-medium"
                    />
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeAttribute(idx)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 mt-5 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Dynamic Variant Image Upload slots (Color specific) */}
            {colorVariantValues.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-800/80">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-orange-400" /> Color Variant Slots (Images map to variations)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {colorVariantValues.map((val) => {
                    const savedItem = variantImages[val];
                    return (
                      <div key={val} className="p-3 rounded-xl border border-slate-850 bg-slate-900/50 flex flex-col gap-2 items-center justify-between text-center relative">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 bg-slate-950/80 rounded border border-slate-850">
                          {val}
                        </span>

                        <label className="w-full flex flex-col items-center justify-center aspect-video border border-dashed border-slate-700 hover:border-indigo-500 rounded-lg p-2 cursor-pointer transition bg-slate-950/40 relative overflow-hidden group">
                          {savedItem ? (
                            <>
                              <img
                                src={savedItem.processed || savedItem.preview}
                                alt={val}
                                className="w-full h-full object-cover rounded"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[9px] font-semibold text-white">Overwrite</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-slate-400 mb-1" />
                              <span className="text-[9px] text-slate-500">Upload {val} Image</span>
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

        {/* ==================== RIGHT PANEL: AI CONTENT & MATRIX ==================== */}
        <section className="space-y-8">
          
          {/* Core Product Info Form */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1524]/90 shadow-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-transparent"></div>
            <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-400 mb-4 flex items-center gap-2">
              <Ruler className="w-4 h-4" /> 4. Product Dimensions & Sizing
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Core Product Name*</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Glow Skincare Serum Niacinamide 10%"
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-850 text-xs focus:outline-none focus:border-indigo-500 text-white font-medium shadow-inner"
                  />
                  <button
                    onClick={generateAiContent}
                    disabled={aiLoading}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 disabled:text-slate-400 text-xs font-bold text-white shadow-lg transition"
                  >
                    {aiLoading ? (
                      <span className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Sparkles className="w-4 h-4 text-orange-400" />
                    )}
                    Generate AI Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Weight (kg)</label>
                <input
                  type="text"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs text-right focus:outline-none focus:border-indigo-500 text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Length (cm)</label>
                <input
                  type="text"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs text-right focus:outline-none focus:border-indigo-500 text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Width (cm)</label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs text-right focus:outline-none focus:border-indigo-500 text-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Height (cm)</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-850 text-xs text-right focus:outline-none focus:border-indigo-500 text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Gemini AI Optimized Content Card */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1524]/90 shadow-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-transparent"></div>
            <h2 className="text-sm uppercase tracking-widest font-bold text-orange-400 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 5. AI Optimized TikTok Shop Content
            </h2>

            {aiContent ? (
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Generated SEO Product Title</label>
                    <span className="text-[9px] text-slate-400 font-mono">({aiContent.tiktok_title.length} chars)</span>
                  </div>
                  <input
                    type="text"
                    value={aiContent.tiktok_title}
                    onChange={(e) => setAiContent({ ...aiContent, tiktok_title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-850 text-xs text-emerald-300 font-bold focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Bullet Point Description</label>
                  <textarea
                    rows={4}
                    value={aiContent.description}
                    onChange={(e) => setAiContent({ ...aiContent, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-850 text-xs text-slate-300 leading-relaxed font-medium focus:outline-none font-sans"
                  />
                </div>

                {/* Market Price Analysis */}
                <div className="p-3.5 rounded-xl border border-indigo-900/20 bg-indigo-950/20 text-slate-300">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold mb-1">
                    <Info className="w-3.5 h-3.5 text-orange-400 animate-pulse" /> Competitor Pricing Analysis
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">{aiContent.market_price_analysis}</p>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-slate-850 border-dashed rounded-xl flex flex-col items-center justify-center text-center gap-2">
                <Sparkles className="w-8 h-8 text-slate-600 mb-1" />
                <p className="text-xs text-slate-400 font-semibold">AI listing content not generated yet</p>
                <p className="text-[10px] text-slate-600 max-w-xs">Type your core product name above and click "Generate AI Copy" to automatically construct SEO-friendly titles and structured bullet features.</p>
              </div>
            )}
          </div>

          {/* dynamic sku matrix pricing combinations table */}
          <div className="rounded-2xl border border-slate-800 bg-[#0E1524]/90 shadow-xl p-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-transparent"></div>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-4">
              <div>
                <h2 className="text-sm uppercase tracking-widest font-bold text-indigo-400 flex items-center gap-2">
                  <Coins className="w-4 h-4" /> 6. Dynamic Variant SKU Pricing Matrix
                </h2>
                <p className="text-[10px] text-slate-500">Cartesian matrix combo. Updates automatically when variations change.</p>
              </div>

              {/* Sku Prefix */}
              <div className="flex gap-2 items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">SKU Prefix:</span>
                <input
                  type="text"
                  value={skuPrefix}
                  onChange={(e) => setSkuPrefix(e.target.value)}
                  placeholder="e.g. BRAND"
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500 text-center"
                />
              </div>
            </div>

            {skuRows.length > 0 ? (
              <div className="overflow-x-auto border border-slate-850 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-850">
                      <th className="p-3 text-slate-400 font-bold uppercase">Variation Combo</th>
                      <th className="p-3 text-slate-400 font-bold uppercase">Auto-Generated SKU</th>
                      <th className="p-3 text-slate-400 font-bold uppercase w-20">Price (THB)*</th>
                      <th className="p-3 text-slate-400 font-bold uppercase w-20">Stock Quantity*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuRows.map((row) => {
                      const comboStr = Object.entries(row.combination)
                        .map(([k, v]) => `${v}`)
                        .join(" - ");

                      return (
                        <tr key={row.id} className="border-b border-slate-850 hover:bg-slate-900/50">
                          <td className="p-3 text-white font-bold">{comboStr}</td>
                          <td className="p-3 text-slate-400 font-mono font-semibold">{row.sku}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.price}
                              onChange={(e) => handleMatrixCellChange(row.id, "price", e.target.value)}
                              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-right focus:outline-none focus:border-indigo-500 text-emerald-400 font-semibold"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={row.stock}
                              onChange={(e) => handleMatrixCellChange(row.id, "stock", e.target.value)}
                              className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-800 text-right focus:outline-none focus:border-indigo-500 text-slate-300 font-semibold"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 border border-slate-850 border-dashed rounded-xl flex items-center justify-center text-center text-xs text-slate-500 font-medium">
                Configure attributes and values to generate combinations matrix.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ==================== FOOTER STICKY ACTION BAR ==================== */}
      <footer className="fixed bottom-0 left-0 w-full bg-[#0E1524]/95 border-t border-slate-800 py-4 px-6 z-40 shadow-2xl backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs text-slate-400 font-medium">
              Uploaded: <strong className="text-white">{mainImages.length} Main</strong> JPEGs |{" "}
              Mapped: <strong className="text-white">{Object.keys(variantImages).length} Variant</strong> slots
            </span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Generate & Brand Images */}
            <button
              onClick={processAllImages}
              disabled={processingImages || mainImages.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold transition disabled:opacity-50"
            >
              {processingImages ? (
                <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Settings className="w-4 h-4" />
              )}
              [1:1 Frame Engine Overlay]
            </button>

            {/* Preview Frame Overlays */}
            <button
              onClick={() => {
                if (allPreviewImages.length === 0) {
                  setToast({ type: "error", message: "Please click standard [1:1 Frame Engine Overlay] first to brand files." });
                  return;
                }
                setActivePreviewIndex(0);
                setPreviewOpen(true);
              }}
              disabled={allPreviewImages.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              [Preview Framed Images]
            </button>

            {/* Export Mass Upload Package */}
            <button
              onClick={triggerPackageExport}
              disabled={exportLoading || mainImages.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-black text-white shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition duration-300"
            >
              {exportLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Download className="w-4 h-4" />
              )}
              [Export TikTok Mass Upload Package]
            </button>
          </div>
        </div>
      </footer>

      {/* ==================== PREMIUM PREVIEW DIALOG MODAL ==================== */}
      {previewOpen && allPreviewImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-[#0E1524] shadow-2xl p-6 relative flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setPreviewOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white transition"
            >
              ✕
            </button>

            {/* Slide Image Area */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="aspect-square w-full max-w-[450px] border border-slate-850 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center relative shadow-inner">
                <img
                  src={allPreviewImages[activePreviewIndex].src}
                  alt={allPreviewImages[activePreviewIndex].title}
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur border border-slate-850 text-orange-400 font-bold px-3 py-1 rounded-lg text-xs">
                  {allPreviewImages[activePreviewIndex].title}
                </span>
                <span className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur border border-slate-850 text-slate-400 font-mono text-[10px] px-2 py-0.5 rounded">
                  1000 x 1000 px (1:1)
                </span>
              </div>
            </div>

            {/* Thumbnail Select sidebar */}
            <div className="w-full md:w-60 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-orange-500" /> Frame Branding Preview
                </h3>
                <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                  Review the processed layouts. Make sure that store logos, border frames, and aspect ratios sit correctly.
                </p>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {allPreviewImages.map((pImg, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePreviewIndex(idx)}
                      className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition ${
                        activePreviewIndex === idx
                          ? "bg-orange-500/10 border-orange-500/40 text-orange-400 font-semibold"
                          : "border-slate-850 hover:bg-slate-900 text-slate-400"
                      }`}
                    >
                      <img
                        src={pImg.src}
                        className="w-8 h-8 rounded border border-slate-800 object-cover"
                      />
                      <span className="text-[10px] truncate flex-1">{pImg.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 mt-6">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-lg transition"
                >
                  Looks Beautiful!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
