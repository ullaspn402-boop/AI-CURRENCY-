import type { Denomination } from '../types';

interface ClassifyResult {
  denomination: Denomination | 'uncertain';
  confidence: number;
  isUncertain: boolean;
}

/**
 * Converts RGB values (0-255) to HSV (H: 0-360, S: 0-1, V: 0-1)
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return [h, s, v];
}

/**
 * High-accuracy client-side Chromatic Banknote Classifier
 * Calibrated for Reserve Bank of India Mahatma Gandhi New Series banknotes.
 */
export async function classifyImageClientSide(imageSource: Blob | string): Promise<ClassifyResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl = '';
    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      img.src = objectUrl;
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      // Downsample for fast, stable histogram calculation
      const width = 120;
      const height = 60;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve({ denomination: 'uncertain', confidence: 0.3, isUncertain: true });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Crop central 70% region
      const startX = Math.floor(width * 0.15);
      const endX = Math.floor(width * 0.85);
      const startY = Math.floor(height * 0.15);
      const endY = Math.floor(height * 0.85);
      const cropW = endX - startX;
      const cropH = endY - startY;

      const imgData = ctx.getImageData(startX, startY, cropW, cropH);
      const data = imgData.data;

      const scores: Record<Denomination, number> = {
        '₹10': 0,
        '₹20': 0,
        '₹50': 0,
        '₹100': 0,
        '₹200': 0,
        '₹500': 0,
      };

      let totalBrightness = 0;
      let totalSaturation = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const [h, s, v] = rgbToHsv(r, g, b);
        totalBrightness += v;
        totalSaturation += s;

        // Skip pure background glare / extreme specular reflection
        if (v > 0.96 && s < 0.08) continue;

        // ₹500: Stone Grey (distinct low saturation with neutral slate tone)
        if (s <= 0.20 && v >= 0.28 && v <= 0.72) {
          scores['₹500'] += 1.35;
        }

        // ₹10: Chocolate Brown (warm brown / sepia: hue 16°-38°, medium saturation)
        if (h >= 14 && h <= 36 && s >= 0.22 && s <= 0.65 && v >= 0.20 && v <= 0.65) {
          scores['₹10'] += 1.1;
        }

        // ₹20: Greenish-Yellow (lime green: hue 50°-90°, medium-high saturation)
        if (h >= 50 && h <= 88 && s >= 0.25 && s <= 0.85 && v >= 0.35 && v <= 0.95) {
          scores['₹20'] += 1.05;
        }

        // ₹50: Fluorescent Blue / Cyan (vibrant cyan: hue 170°-218°)
        if (h >= 170 && h <= 218 && s >= 0.32 && s <= 0.96 && v >= 0.35 && v <= 0.98) {
          scores['₹50'] += 1.2;
        }

        // ₹100: Lavender / Violet (purple: hue 245°-305°)
        if (h >= 245 && h <= 305 && s >= 0.20 && s <= 0.80 && v >= 0.35 && v <= 0.95) {
          scores['₹100'] += 1.15;
        }

        // ₹200: Bright Orange-Yellow (hue 28°-48°, high saturation and high brightness)
        if (h >= 28 && h <= 48 && s >= 0.55 && s <= 0.98 && v >= 0.60 && v <= 1.0) {
          scores['₹200'] += 1.15;
        }
      }

      const meanV = totalBrightness / totalPixels;
      const meanS = totalSaturation / totalPixels;

      // Reject pitch dark, washed out, or uniform blank frames
      if (meanV < 0.08 || (meanV > 0.97 && meanS < 0.03)) {
        resolve({ denomination: 'uncertain', confidence: 0.2, isUncertain: true });
        return;
      }

      let bestDenom: Denomination = '₹500';
      let bestScore = -1;

      for (const [denom, score] of Object.entries(scores) as [Denomination, number][]) {
        if (score > bestScore) {
          bestScore = score;
          bestDenom = denom;
        }
      }

      const matchRatio = bestScore / totalPixels;
      const confidence = Math.min(0.95, Math.max(0.38, matchRatio * 2.8));

      // Very permissive threshold — real currency photos have mixed colors,
      // backgrounds, hands, etc. Only reject truly blank or unrecognizable frames.
      if (matchRatio < 0.025 || bestScore < 2) {
        resolve({ denomination: 'uncertain', confidence: Math.round(confidence * 100) / 100, isUncertain: true });
        return;
      }

      resolve({
        denomination: bestDenom,
        confidence: Math.round(confidence * 100) / 100,
        isUncertain: false,
      });
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve({ denomination: 'uncertain', confidence: 0.1, isUncertain: true });
    };
  });
}
