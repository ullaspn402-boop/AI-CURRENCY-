import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Camera, Volume2, ArrowRight, Check, Sparkles, Mic, VolumeX } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useVoice } from '../contexts/VoiceContext';
import { useSettings } from '../contexts/SettingsContext';
import Button from '../components/Button';
import AccessibilityModeToggle from '../components/AccessibilityModeToggle';

interface Step {
  title: string;
  subtitle: string;
  description: string;
  icon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number | string }>;
  accentColor: string;
}

const steps: Step[] = [
  {
    title: 'Welcome to Drishti AI',
    subtitle: 'Currency Assistant for Visually Impaired',
    description:
      'Recognize Indian Rupee banknotes instantly, hear their value clearly, and gain financial independence. Choose your preferred accessibility mode below.',
    icon: Eye,
    accentColor: 'from-cyan-500 to-teal-500',
  },
  {
    title: 'Banknote Recognition',
    subtitle: 'Point Rear Camera & Identify',
    description:
      'Hold your phone flat, about 15 to 20 centimetres above the banknote on a plain surface. Drishti AI recognizes ₹10, ₹20, ₹50, ₹100, ₹200, and ₹500 denominations.',
    icon: Camera,
    accentColor: 'from-teal-500 to-emerald-500',
  },
  {
    title: 'Voice-First Controls',
    subtitle: 'Push to Talk Voice Commands',
    description:
      'Use spoken commands like "Scan Currency", "Capture", "Repeat Result", "Stop Speaking", "Open History", or "Help". Audio feedback announces all results.',
    icon: Volume2,
    accentColor: 'from-cyan-400 to-blue-500',
  },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { completeOnboarding } = useApp();
  const { speak, triggerHaptic } = useVoice();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  // One-time welcome announcement on first render (step 0 only)
  useEffect(() => {
    speak('Welcome to Drishti AI. Your currency recognition assistant is ready.');
  }, []);

  useEffect(() => {
    // Announce current step for screen readers / voice users
    const textToSpeak = `${step.title}. ${step.subtitle}. ${step.description}`;
    speak(textToSpeak);
  }, [currentStep, step, speak]);

  const handleNext = () => {
    triggerHaptic('selection');
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleComplete = () => {
    completeOnboarding();
    triggerHaptic('success');
    speak(
      `Welcome to Drishti AI Home. Running in ${
        settings.accessibilityMode === 'voice' ? 'Voice Mode' : 'Visual Mode'
      }. Tap Scan Currency to begin.`
    );
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-[#0a1633] text-white flex flex-col justify-between p-5 max-w-lg mx-auto">
      {/* Header bar with Skip */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Eye className="w-5 h-5 text-navy-950 font-bold" aria-hidden="true" />
          </div>
          <span className="font-extrabold tracking-wider bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent text-lg">
            DRISHTI AI
          </span>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={handleComplete}
            className="text-cyan-400 hover:text-cyan-300 font-bold text-sm px-3 py-2 rounded-xl hover:bg-white/5 transition-colors focus:ring-2 focus:ring-cyan-400 min-h-[48px] flex items-center"
            aria-label="Skip onboarding and go directly to home"
          >
            Skip to Home
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center my-6 text-center" role="region" aria-label="Onboarding step">
        {/* Step Icon Badge */}
        <div className="relative mb-6">
          <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${step.accentColor} flex items-center justify-center shadow-2xl shadow-cyan-500/20`}>
            <step.icon className="w-12 h-12 text-navy-950" aria-hidden="true" />
          </div>
          <div className="absolute -inset-2 bg-cyan-400/20 blur-xl rounded-full -z-10" />
        </div>

        {/* Title & Tagline */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 leading-tight">
          {step.title}
        </h1>
        <p className="text-cyan-300 font-bold text-base mb-3 tracking-wide">
          {step.subtitle}
        </p>

        {/* Description */}
        <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-sm mb-5">
          {step.description}
        </p>

        {/* Accessibility Mode Choice on Step 1 */}
        {currentStep === 0 && (
          <div className="w-full max-w-sm mb-4">
            <AccessibilityModeToggle />
          </div>
        )}

        {/* Supported notes badge on step 2 */}
        {currentStep === 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-4" aria-label="Supported denominations: ₹10, ₹20, ₹50, ₹100, ₹200, ₹500">
            {['₹10', '₹20', '₹50', '₹100', '₹200', '₹500'].map((denom) => (
              <span
                key={denom}
                className="px-3 py-1.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-300 text-sm font-bold shadow-sm"
              >
                {denom}
              </span>
            ))}
          </div>
        )}

        {/* Voice commands overview on step 3 */}
        {currentStep === 2 && (
          <div className="w-full max-w-sm bg-navy-900/80 border border-cyan-500/30 rounded-2xl p-3 text-left space-y-1.5 text-xs text-cyan-200 mb-4">
            <div className="font-extrabold text-white text-sm mb-1 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              Available Spoken Commands:
            </div>
            <div>• <strong>&quot;Scan Currency&quot;</strong> — Opens camera scanner</div>
            <div>• <strong>&quot;Capture&quot;</strong> — Takes banknote photo</div>
            <div>• <strong>&quot;Repeat Result&quot;</strong> — Replays detected value</div>
            <div>• <strong>&quot;Stop Speaking&quot;</strong> — Immediately silences audio</div>
            <div>• <strong>&quot;Open History&quot;</strong> — Views past scans</div>
            <div>• <strong>&quot;Help&quot;</strong> — Speaks user instructions</div>
          </div>
        )}
      </main>

      {/* Footer navigation */}
      <footer className="space-y-4 pb-4">
        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-3" aria-label={`Step ${currentStep + 1} of ${steps.length}`}>
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setCurrentStep(idx);
              }}
              className={`h-2.5 rounded-full transition-all duration-300 min-h-[24px] px-1 flex items-center justify-center ${
                idx === currentStep ? 'w-8 bg-cyan-400' : 'w-4 bg-gray-700 hover:bg-gray-600'
              }`}
              aria-label={`Go to step ${idx + 1}`}
              aria-current={idx === currentStep ? 'step' : undefined}
            >
              <span className="sr-only">Step {idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div className="w-full">
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={handleNext}
            iconRight={isLast ? <Check className="w-6 h-6 text-navy-950" aria-hidden="true" /> : <ArrowRight className="w-6 h-6 text-navy-950" aria-hidden="true" />}
            className="py-4 text-navy-950 font-black text-lg bg-gradient-to-r from-cyan-400 to-teal-400 min-h-[56px]"
            aria-label={isLast ? 'Complete onboarding and start using Drishti AI' : 'Continue to next step'}
          >
            {isLast ? 'Start Drishti AI' : 'Continue'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
