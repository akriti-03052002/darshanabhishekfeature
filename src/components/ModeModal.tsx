import React from 'react';
import { Eye, Smartphone, X } from 'lucide-react';
import { ExperienceSpec, Language, ViewMode } from '../data/experiences';

interface ModeModalProps {
  experience: ExperienceSpec;
  lang: Language;
  onChooseMode: (mode: ViewMode) => void;
  onClose: () => void;
}

export const ModeModal: React.FC<ModeModalProps> = ({
  experience,
  lang,
  onChooseMode,
  onClose
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mode-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-[#362c22] bg-[#16120e] p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'hi' ? 'बंद करें' : 'Close mode selection'}
          className="absolute right-4 top-4 rounded-lg p-2 text-[#a89c8c] hover:bg-[#241d16] hover:text-amber-100 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-xs font-medium text-amber-400">
          {experience.traditionLabel[lang]}
        </p>
        <h2
          id="mode-dialog-title"
          className="font-display mt-1 text-3xl font-semibold text-[#faf5ed]"
        >
          {experience.title[lang]}
        </h2>
        <p className="mt-2 text-sm text-[#b2a797]">
          {lang === 'hi'
            ? 'दर्शन व सेवा प्रारंभ करने के लिए केवल एक मोड चुनें:'
            : 'Choose your viewing mode to enter immediately:'}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Mode 1: Normal Screen */}
          <button
            type="button"
            onClick={() => onChooseMode('normal')}
            className="flex flex-col items-start rounded-xl border border-[#3a2f23] bg-[#1f1913] p-5 text-left hover:border-amber-500 hover:bg-[#261e16] transition-colors cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/20 text-amber-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <span className="mt-4 text-lg font-semibold text-[#faf5ed]">
              {lang === 'hi' ? 'Normal Screen' : 'Normal Screen'}
            </span>
            <span className="mt-1.5 text-xs leading-relaxed text-[#b2a797]">
              {lang === 'hi'
                ? 'फ़ोन, टैबलेट व लैपटॉप — टच, ड्रैग व क्लिक से अपने हाथों से पूजा करें।'
                : 'Phone, tablet & desktop — control virtual hands with touch, drag & click.'}
            </span>
          </button>

          {/* Mode 2: VR Headset */}
          <button
            type="button"
            onClick={() => onChooseMode('vr')}
            className="flex flex-col items-start rounded-xl border border-[#3a2f23] bg-[#1f1913] p-5 text-left hover:border-amber-500 hover:bg-[#261e16] transition-colors cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/20 text-amber-400">
              <Eye className="h-5 w-5" />
            </div>
            <span className="mt-4 text-lg font-semibold text-[#faf5ed]">
              {lang === 'hi' ? 'VR Headset / WebXR' : 'VR Headset / WebXR'}
            </span>
            <span className="mt-1.5 text-xs leading-relaxed text-[#b2a797]">
              {lang === 'hi'
                ? 'स्मार्टफ़ोन VR बॉक्स एवं WebXR हेडसेट — 3D इमर्सिव दृश्य व दृष्टि (Gaze) नियंत्रण।'
                : 'Smartphone VR Box & WebXR Headset — immersive 3D stereoscopic view & gaze interaction.'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
