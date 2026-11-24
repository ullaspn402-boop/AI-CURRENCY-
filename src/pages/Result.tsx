import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Volume2,
  RotateCcw,
  Square,
  Camera,
  History as HistoryIcon,
  CheckCircle2,
  Sparkles,
  Info,
  ShieldCheck,
  WifiOff,
  Cpu,
} from 'lucide-react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Card from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { useVoice } from '../contexts/VoiceContext';
import { useSettings } from '../contexts/SettingsContext';
import { historyService } from '../services/historyService';
import type { RecognitionResult, Denomination } from '../types';

const DENOMINATION_NAMES: Record<string, { words: string; colorClass: string; details: string }> = {
  '₹10': { words: 'Ten Rupees', colorClass: 'text-amber-400', details: 'Chocolate Brown Note • Sun Temple Motif' },
  '₹20': { words: 'Twenty Rupees', colorClass: 'text-lime-400', details: 'Greenish-Yellow Note • Ellora Caves Motif' },
  '₹50': { words: 'Fifty Rupees', colorClass: 'text-cyan-400', details: 'Fluorescent Blue Note • Hampi with Chariot' },
  '₹100': { words: 'One Hundred Rupees', colorClass: 'text-indigo-400', details: 'Lavender Note • Rani Ki Vav Motif' },
  '₹200': { words: 'Two Hundred Rupees', colorClass: 'text-orange-400', details: 'Bright Yellow-Orange Note • Sanchi Stupa Motif' },
  '₹500': { words: 'Five Hundred Rupees', colorClass: 'text-emerald-400', details: 'Stone Grey Note • Red Fort Motif' },
};

export default function Result() {
  const navigate = useNavigate();
  const { currentResult, setCurrentResult, setCapturedImage } = useApp();
  const { speak, stop, repeat, isSpeaking, announceDenomination, triggerHaptic } = useVoice();
  const { settings } = useSettings();

  // If no current result, attempt to grab latest from history
  const [result, setResult] = useState<RecognitionResult | null>(() => {
    if (currentResult) return currentResult;
    const history = historyService.getHistory();
    return history.length > 0 ? history[0] : null;
  });

  const denomKey = result?.denomination || '₹500';
  const meta = DENOMINATION_NAMES[denomKey] || {
    words: `${denomKey.replace('₹', '')} Rupees`,
    colorClass: 'text-cyan-400',
    details: 'Indian Rupee Banknote',
  };

  useEffect(() => {
    if (result) {
      triggerHaptic('success');
      announceDenomination(result.denomination, result.confidence);
    }
  }, [result]);

  const handleScanAnother = () => {
    setCapturedImage(null);
    setCurrentResult(null);
    triggerHaptic('selection');
    speak('Ready for next banknote.');
    navigate('/scan');
  };

  const handleListenAgain = () => {
    if (!result) return;
    triggerHaptic('selection');
    const clean = result.denomination.replace('₹', '');
    speak(`This is a ${clean} rupees note. ${meta.words}.`);
  };

  if (!result) {
    return (
      <Layout title="Recognition Result">
        <div className="text-center py-12 space-y-4">
          <p className="text-gray-300 text-lg font-semibold">No scan result available.</p>
          <Button
            variant="primary"
            onClick={() => navigate('/home')}
            aria-label="Go to home dashboard"
          >
            Go to Home
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Banknote Recognized" showBack={false}>
      <div className="space-y-5 text-center">
        {/* Main Result Card */}
        <div
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0c2452] via-[#091b3b] to-[#07132a] border-2 border-cyan-400/40 p-6 sm:p-8 shadow-2xl shadow-cyan-950/60 animate-[fadeIn_0.4s_ease-out]"
          role="region"
          aria-label={`Recognized currency: ${result.denomination}, ${meta.words}`}
          aria-live="assertive"
        >
          {/* Top Status & Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <CheckCircle2 className="w-4 h-4 text-teal-400" aria-hidden="true" />
              <span>Recognized</span>
            </div>

            {result.isDemo ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                DEMO MODE
              </span>
            ) : result.engineUsed === 'gemini-vision' ? (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                aria-label="Recognized using Gemini Vision AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                Gemini Vision AI
              </span>
            ) : result.engineUsed === 'on-device' ? (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30"
                aria-label="Recognized using on-device classifier (offline)"
              >
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                On-device
              </span>
            ) : result.engineUsed === 'ai-backend' ? (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                aria-label="Recognized using AI backend"
              >
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                AI Backend
              </span>
            ) : (
              result.confidence !== undefined && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {Math.round(result.confidence * 100)}% Confidence
                </span>
              )
            )}
          </div>

          {/* Huge Denomination Display */}
          <div className="my-5">
            <span
              className="text-6xl sm:text-7xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-teal-200 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(34,211,238,0.35)]"
              aria-hidden="true"
            >
              {result.denomination}
            </span>

            <h1 className={`text-2xl sm:text-3xl font-extrabold mt-3 ${meta.colorClass}`}>
              {meta.words}
            </h1>

            <p className="text-xs sm:text-sm text-gray-300 font-medium mt-1">
              {meta.details}
            </p>

            {/* Confidence line (only when available and not demo) */}
            {!result.isDemo && result.confidence !== undefined && (
              <p className="text-xs text-gray-400 mt-1">
                Confidence: {Math.round(result.confidence * 100)}%
              </p>
            )}
          </div>

          {/* Optional Image Thumbnail */}
          {result.imageUrl && (
            <div className="w-36 h-20 mx-auto rounded-xl overflow-hidden border border-white/20 mb-4 bg-black">
              <img
                src={result.imageUrl}
                alt="Scanned banknote"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 bg-black/30 rounded-xl py-1.5 px-3 border border-white/5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" aria-hidden="true" />
            <span>Denomination identification only • Does not authenticate notes</span>
          </div>
        </div>

        {/* Voice Announcement Audio Controls */}
        <section
          aria-label="Spoken Voice Controls"
          className="rounded-2xl bg-[#0f2347] border border-white/10 p-4 space-y-3"
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-cyan-300">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" aria-hidden="true" />
              Spoken Voice Feedback
            </span>
            {isSpeaking && (
              <span className="text-teal-300 animate-pulse">Speaking now…</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={handleListenAgain}
              iconLeft={<Volume2 className="w-4 h-4" aria-hidden="true" />}
              aria-label="Listen to banknote value again"
              className="min-h-[48px]"
            >
              Listen
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                triggerHaptic('selection');
                repeat();
              }}
              iconLeft={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
              aria-label="Repeat last voice announcement"
              className="min-h-[48px]"
            >
              Repeat
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                triggerHaptic('selection');
                stop();
              }}
              iconLeft={<Square className="w-4 h-4" aria-hidden="true" />}
              aria-label="Stop voice speech"
              className="min-h-[48px]"
            >
              Stop
            </Button>
          </div>
        </section>

        {/* Primary Action Buttons */}
        <div className="space-y-3 pt-1">
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={handleScanAnother}
            iconLeft={<Camera className="w-6 h-6 text-navy-950" aria-hidden="true" />}
            className="font-extrabold text-navy-950 bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-300 py-4 text-lg min-h-[56px]"
            aria-label="Scan another banknote"
          >
            SCAN ANOTHER NOTE
          </Button>

          <Button
            variant="ghost"
            size="md"
            fullWidth
            onClick={() => navigate('/history')}
            iconLeft={<HistoryIcon className="w-5 h-5" aria-hidden="true" />}
            aria-label="View recognition history"
            className="min-h-[48px]"
          >
            View Recognition History
          </Button>
        </div>
      </div>
    </Layout>
  );
}
