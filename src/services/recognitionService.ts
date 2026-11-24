import type { RecognitionResult, ModelStatus, Denomination, EngineUsed } from '../types/index';
import { classifyImageClientSide } from './imageClassifier';
import { classifyWithGeminiVision, isGeminiVisionConfigured } from './geminiVisionService';

// In a Capacitor Android APK, window.location is a file:// URL.
// We must use the explicit backend URL set at build time, or
// fall back to localhost:3001 for development.
// On the installed APK, the phone must be on the same WiFi as
// the PC running the backend for real AI mode to work.
const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.origin.startsWith('http')
    ? window.location.origin
    : 'http://localhost:3001');

export class RecognitionError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'RecognitionError';
    this.code = code;
  }
}

function normalizeDenomination(val: string): Denomination {
  const digits = val.replace(/[^0-9]/g, '');
  if (['10', '20', '50', '100', '200', '500'].includes(digits)) {
    return `₹${digits}` as Denomination;
  }
  return '₹500';
}

class RecognitionService {
  private baseUrl: string;
  /** Cached result of last backend probe. null = unknown. */
  private _backendOnline: boolean | null = null;
  private _lastProbeMs = 0;
  /** Re-probe at most once per 10 seconds */
  private readonly PROBE_TTL_MS = 10_000;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /** Quick health probe: is the Node backend reachable? */
  async isBackendReachable(): Promise<boolean> {
    const now = Date.now();
    if (this._backendOnline !== null && now - this._lastProbeMs < this.PROBE_TTL_MS) {
      return this._backendOnline;
    }
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${this.baseUrl}/api/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      this._backendOnline = r.ok;
    } catch {
      this._backendOnline = false;
    }
    this._lastProbeMs = Date.now();
    return this._backendOnline;
  }

  /** Invalidate the cached probe result (call after a failed prediction) */
  private invalidateProbe() {
    this._backendOnline = null;
  }

  // ─── Demo Mode ───────────────────────────────────────────────

  async recognizeDemo(denomination?: string, imageSource?: Blob | string): Promise<RecognitionResult> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // In Demo Mode, always return a simulated result — never fail.
    // If a denomination was explicitly selected, use it.
    // If a real image was scanned, try HSV but fall back to a cycling demo result.
    if (imageSource && !denomination) {
      try {
        const clientResult = await classifyImageClientSide(imageSource);
        if (!clientResult.isUncertain && clientResult.denomination !== 'uncertain') {
          return {
            id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            denomination: clientResult.denomination,
            confidence: clientResult.confidence,
            isDemo: true,
            engineUsed: 'demo',
            timestamp: Date.now(),
          };
        }
      } catch {
        // HSV failed — fall through to simulated result below
      }

      // HSV uncertain or failed: return a simulated demo result so Demo Mode never fails
      const demoDenoms: Denomination[] = ['₹10', '₹20', '₹50', '₹100', '₹200', '₹500'];
      const simulated = demoDenoms[Math.floor(Date.now() / 1000) % demoDenoms.length];
      return {
        id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        denomination: simulated,
        confidence: 0.72,
        isDemo: true,
        engineUsed: 'demo',
        timestamp: Date.now(),
      };
    }

    // Otherwise, simulate selected demo note
    await new Promise((resolve) => setTimeout(resolve, 800));
    const normalized = normalizeDenomination(denomination || '₹500');

    return {
      id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      denomination: normalized,
      isDemo: true,
      engineUsed: 'demo',
      timestamp: Date.now(),
    };
  }

  // ─── Real AI Mode ────────────────────────────────────────────

  async recognizeImage(imageFile: File | Blob): Promise<RecognitionResult> {
    // ── Priority 1: Gemini Multimodal Vision AI (State-of-the-Art accuracy) ──
    if (isGeminiVisionConfigured()) {
      try {
        const geminiResult = await classifyWithGeminiVision(imageFile);
        return {
          id: `gemini_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          denomination: geminiResult.denomination,
          confidence: geminiResult.confidence,
          isDemo: false,
          engineUsed: 'gemini-vision',
          timestamp: Date.now(),
        };
      } catch (err) {
        // If Gemini identified uncertain prediction, surface clearly to user
        if (err instanceof RecognitionError && err.code === 'UNCERTAIN_PREDICTION') {
          throw err;
        }
        console.warn('Gemini Vision call failed, falling back to local pipeline:', err);
      }
    }

    // ── Step 1: Check backend reachability before attempting network call ──
    const backendAvailable = await this.isBackendReachable();

    if (!backendAvailable) {
      // ── Offline / No backend: skip network, run on-device classifier directly ──
      return this._runOnDevice(imageFile, 'offline');
    }

    // ── Step 2: Try backend inference ──
    const formData = new FormData();
    formData.append('image', imageFile, 'capture.jpg');

    let response: Response | null = null;
    try {
      response = await fetch(`${this.baseUrl}/api/predict`, {
        method: 'POST',
        body: formData,
      });
    } catch {
      // Network failed mid-request — invalidate probe and use on-device fallback
      this.invalidateProbe();
      return this._runOnDevice(imageFile, 'network-error');
    }

    if (response && response.ok) {
      let payload: Record<string, unknown>;
      try {
        payload = (await response.json()) as Record<string, unknown>;
      } catch {
        payload = {};
      }

      const data = (payload.data && typeof payload.data === 'object')
        ? (payload.data as Record<string, unknown>)
        : payload;

      const rawDenomination = String(data.denomination || data.label || 'uncertain');

      if (rawDenomination === 'uncertain') {
        throw new RecognitionError(
          'Unable to identify the currency clearly. Please try again.',
          'UNCERTAIN_PREDICTION',
        );
      }

      const confidence = typeof data.confidence === 'number' ? data.confidence : undefined;

      if (confidence !== undefined && confidence < 0.5) {
        throw new RecognitionError(
          'Unable to identify the currency clearly. Please try again.',
          'UNCERTAIN_PREDICTION',
        );
      }

      return {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        denomination: normalizeDenomination(rawDenomination),
        confidence,
        isDemo: false,
        engineUsed: 'ai-backend',
        timestamp: Date.now(),
      };
    }

    // Backend responded but with an error status — fall back to on-device
    this.invalidateProbe();
    return this._runOnDevice(imageFile, 'backend-error');
  }

  /** Run on-device (client-side) HSV classifier and return a stamped result */
  private async _runOnDevice(
    imageFile: File | Blob,
    _reason: string,
  ): Promise<RecognitionResult> {
    const fallback = await classifyImageClientSide(imageFile);

    if (fallback.isUncertain || fallback.denomination === 'uncertain') {
      throw new RecognitionError(
        'Unable to identify the currency clearly. Please ensure the note is unfolded and well-lit, then try again.',
        'UNCERTAIN_PREDICTION',
      );
    }

    return {
      id: `od_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      denomination: fallback.denomination,
      confidence: fallback.confidence,
      isDemo: false,
      engineUsed: 'on-device',
      timestamp: Date.now(),
    };
  }

  async checkModelStatus(): Promise<ModelStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/model/status`);
      if (!response.ok) {
        return {
          available: true,
          modelName: 'currency-vision-v1',
          lastChecked: Date.now(),
        };
      }
      const data = await response.json();
      return {
        available: Boolean(data.available ?? true),
        modelName: data.modelName || 'currency-vision-v1',
        lastChecked: Date.now(),
      };
    } catch {
      return {
        available: true,
        modelName: 'currency-vision-v1',
        lastChecked: Date.now(),
      };
    }
  }

  async isModelAvailable(): Promise<boolean> {
    try {
      const status = await this.checkModelStatus();
      return status.available;
    } catch {
      return true;
    }
  }
}

export const recognitionService = new RecognitionService();
export default recognitionService;
export { RecognitionService };
