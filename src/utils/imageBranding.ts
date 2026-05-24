export interface BrandingOptions {
  aspectMode: "cover" | "contain";
  backgroundColor: string;
  frameStyle: "none" | "minimalist-corners" | "elegant-double" | "clean-border";
  frameColor: string;
  logoFile: File | null;
  logoText: string;
  logoScale: number; // 0.5 to 1.5 multiplier
}

/**
 * Utility to load an image URL into an HTMLImageElement safely in a Promise.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + src));
    img.src = src;
  });
}

/**
 * Processes a single input image through the canvas branding engine.
 * Outputs a base64-encoded JPEG image at 1000x1000px.
 */
export async function processBrandedImage(
  imageSrc: string,
  options: BrandingOptions
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D rendering context.");
  }

  // 1. Load the main product image
  const img = await loadImage(imageSrc);

  // 2. Draw background color
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, 1000, 1000);

  // 3. Draw standardizing image (1:1 Ratio)
  const canvasWidth = 1000;
  const canvasHeight = 1000;
  const imgWidth = img.width;
  const imgHeight = img.height;

  const imgRatio = imgWidth / imgHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (options.aspectMode === "cover") {
    // Fill the 1000x1000 square, cropping the excess
    if (imgRatio > 1) {
      // Landscape image
      drawWidth = canvasHeight * imgRatio;
      offsetX = -(drawWidth - canvasWidth) / 2;
    } else {
      // Portrait image
      drawHeight = canvasWidth / imgRatio;
      offsetY = -(drawHeight - canvasHeight) / 2;
    }
  } else {
    // Contain inside the 1000x1000 square, showing padding
    if (imgRatio > 1) {
      // Landscape: match width, center vertically
      drawHeight = canvasWidth / imgRatio;
      offsetY = (canvasHeight - drawHeight) / 2;
    } else {
      // Portrait: match height, center horizontally
      drawWidth = canvasHeight * imgRatio;
      offsetX = (canvasWidth - drawWidth) / 2;
    }
  }

  // Draw the main image on the canvas
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

  // 4. Draw Custom Geometric Border Overlays
  ctx.save();
  ctx.strokeStyle = options.frameColor;
  ctx.lineWidth = 8;
  ctx.lineJoin = "miter";

  const inset = 16; // Inset from canvas edges

  if (options.frameStyle === "clean-border") {
    // Standard sleek corporate frame
    ctx.lineWidth = 12;
    ctx.strokeRect(inset, inset, 1000 - inset * 2, 1000 - inset * 2);
  } else if (options.frameStyle === "elegant-double") {
    // Double lines border
    ctx.lineWidth = 4;
    ctx.strokeRect(inset, inset, 1000 - inset * 2, 1000 - inset * 2);
    ctx.lineWidth = 2;
    ctx.strokeRect(inset + 8, inset + 8, 1000 - (inset + 8) * 2, 1000 - (inset + 8) * 2);
  } else if (options.frameStyle === "minimalist-corners") {
    // Geometric high-tech corner brackets
    ctx.lineWidth = 8;
    const len = 80; // Corner arm length
    
    // Top-Left Corner
    ctx.beginPath();
    ctx.moveTo(inset + len, inset);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset, inset + len);
    ctx.stroke();

    // Top-Right Corner
    ctx.beginPath();
    ctx.moveTo(1000 - inset - len, inset);
    ctx.lineTo(1000 - inset, inset);
    ctx.lineTo(1000 - inset, inset + len);
    ctx.stroke();

    // Bottom-Left Corner
    ctx.beginPath();
    ctx.moveTo(inset + len, 1000 - inset);
    ctx.lineTo(inset, 1000 - inset);
    ctx.lineTo(inset, 1000 - inset - len);
    ctx.stroke();

    // Bottom-Right Corner
    ctx.beginPath();
    ctx.moveTo(1000 - inset - len, 1000 - inset);
    ctx.lineTo(1000 - inset, 1000 - inset);
    ctx.lineTo(1000 - inset, 1000 - inset - len);
    ctx.stroke();
  }
  ctx.restore();

  // 5. Draw Store Logo (Top-Right Corner)
  ctx.save();
  const logoTargetWidth = 140 * options.logoScale;
  const logoTargetHeight = 55 * options.logoScale;
  const logoMargin = 30; // Margin from edges
  const logoX = 1000 - logoTargetWidth - logoMargin;
  const logoY = logoMargin;

  if (options.logoFile) {
    try {
      const logoUrl = URL.createObjectURL(options.logoFile);
      const logoImg = await loadImage(logoUrl);
      
      // Calculate dimensions maintaining logo aspect ratio
      const logoRatio = logoImg.width / logoImg.height;
      let drawnLogoW = logoTargetWidth;
      let drawnLogoH = logoTargetWidth / logoRatio;

      // Adjust height if it overflows target height
      if (drawnLogoH > logoTargetHeight) {
        drawnLogoH = logoTargetHeight;
        drawnLogoW = logoTargetHeight * logoRatio;
      }

      // Recompute centered logo position within top-right zone
      const centeredX = 1000 - drawnLogoW - logoMargin;
      const centeredY = logoMargin + (logoTargetHeight - drawnLogoH) / 2;

      ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(logoImg, centeredX, centeredY, drawnLogoW, drawnLogoH);
      URL.revokeObjectURL(logoUrl);
    } catch (err) {
      console.error("Failed to render custom store logo. Falling back to text logo.", err);
      drawTextLogo(ctx, options.logoText, logoX, logoY, logoTargetWidth, logoTargetHeight);
    }
  } else {
    // Draw text-based corporate logo
    drawTextLogo(ctx, options.logoText, logoX, logoY, logoTargetWidth, logoTargetHeight);
  }
  ctx.restore();

  // Return base64 URL
  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Draws a modern text pill badge logo on the canvas when no custom image is provided.
 */
function drawTextLogo(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const brandName = text.trim() || "STORE BRAND";
  
  // Background badge block (sleek dark glass or colored block)
  ctx.fillStyle = "rgba(11, 15, 25, 0.85)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  
  // Rounded rectangle path for the logo badge
  const radius = 6;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Logo text styling (sleek modern typography)
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(brandName.toUpperCase(), x + w / 2, y + h / 2, w - 10);
}
