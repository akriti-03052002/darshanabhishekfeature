import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Globe,
  Hand,
  RotateCcw,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { ExperienceSpec, Language, ViewMode } from '../data/experiences';
import { formatRitualProgress } from '../logic/ritualEngine';
import { RitualAudioEngine } from '../audio/ritualAudio';
import { RitualSceneManager, SceneHudSnapshot } from '../three/RitualSceneManager';
import {
  GestureGuideCard,
  GestureUiSnapshot,
  VirtualHandController
} from './VirtualHandController';

interface RitualViewportProps {
  experience: ExperienceSpec;
  mode: ViewMode;
  lang: Language;
  onToggleLang: () => void;
  onExit: () => void;
}

export const RitualViewport: React.FC<RitualViewportProps> = ({
  experience,
  mode,
  lang,
  onToggleLang,
  onExit
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<RitualSceneManager | null>(null);
  const audioRef = useRef<RitualAudioEngine | null>(null);

  const [muted, setMuted] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [tiltSlider, setTiltSlider] = useState(0);
  const [motionPermissionNeeded, setMotionPermissionNeeded] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [gesturePaused, setGesturePaused] = useState(false);
  const [gestureUi, setGestureUi] = useState<GestureUiSnapshot>({
    phase: 'IDLE',
    progress: 0,
    confidence: 0
  });
  const cancelGestureRef = useRef<(() => void) | null>(null);

  const [hud, setHud] = useState<SceneHudSnapshot>({
    activeStepId: experience.steps[0]?.id ?? null,
    heldStepId: null,
    completedIds: [],
    pourRate: 0,
    tiltAngleRad: 0,
    tiltDegrees: 0,
    actionProgress: 0,
    tasbihCount: 0,
    gazeTargetId: null,
    gazeProgress: 0,
    sensorActive: false,
    bannerTextKey: 'idle',
    handGesture: 'idle',
    canPlaceHeld: false,
    nearStepId: null,
    lastCompletedId: null
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const audio = new RitualAudioEngine();
    audioRef.current = audio;
    audio.startAmbient(experience.audioProfile);

    setAssetsReady(false);

    const mgr = new RitualSceneManager(
      el,
      experience,
      mode,
      audio,
      (snap) => {
        setHud(snap);
      },
      () => {
        setAssetsReady(true);
      }
    );
    managerRef.current = mgr;

    if (
      mode === 'vr' &&
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      setMotionPermissionNeeded(true);
    }

    document.body.dataset.state = mode === 'vr' ? 'vr-ritual' : 'normal-ritual';

    return () => {
      mgr.dispose();
      audio.dispose();
      managerRef.current = null;
      audioRef.current = null;
      document.body.dataset.state = 'selection';
    };
  }, [experience, mode]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRef.current?.setMuted(next);
  };

  const handleRequestMotion = async () => {
    try {
      const fn = (
        DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      ).requestPermission;
      if (fn) {
        const res = await fn();
        if (res === 'granted') {
          setMotionPermissionNeeded(false);
          managerRef.current?.recenterVR();
        }
      }
    } catch {
      setMotionPermissionNeeded(false);
    }
  };

  const activeStep =
    experience.steps.find((s) => s.id === (hud.heldStepId ?? hud.activeStepId)) ??
    (hud.heldStepId?.startsWith('bhog-item-')
      ? experience.steps.find((s) => s.id === 'bhog-shiva')
      : undefined) ??
    experience.steps[0];

  const isHoldingPour =
    hud.heldStepId !== null &&
    (activeStep?.kind === 'pour-water' || activeStep?.kind === 'pour-milk');

  const isHoldingAny = hud.heldStepId !== null;

  const gestureLabel = (() => {
    if (hud.handGesture === 'pour') {
      return lang === 'hi'
        ? `धारा प्रवाह · ${hud.tiltDegrees}°`
        : `Pouring · ${hud.tiltDegrees}°`;
    }
    if (hud.handGesture === 'wave') {
      return lang === 'hi' ? 'आरती / सेवा गति' : 'Rhythmic Wave';
    }
    if (hud.handGesture === 'grip') {
      if (hud.heldCustomLabel) {
        return lang === 'hi'
          ? `हाथ में: ${hud.heldCustomLabel.hi}`
          : `Holding: ${hud.heldCustomLabel.en}`;
      }
      return hud.canPlaceHeld
        ? lang === 'hi'
          ? 'हाथ में — वेदी पर रखें'
          : 'Held — Move & Place on Altar'
        : lang === 'hi'
        ? 'पात्र हाथ में है'
        : 'Holding in Hand';
    }
    if (hud.handGesture === 'reach') {
      return lang === 'hi' ? 'खुला हाथ · स्पर्श' : 'Open Hand · Reach';
    }
    if (hud.handGesture === 'release') {
      return lang === 'hi' ? 'कोमल समर्पण' : 'Gentle Release';
    }
    return lang === 'hi' ? 'स्पर्श / ड्रैग तैयार' : 'Touch & Drag / Camera';
  })();

  const promptLine = (() => {
    if (hud.heldCustomAction) {
      return hud.heldCustomAction[lang];
    }
    if (hud.completedIds.length === experience.steps.length) {
      return lang === 'hi'
        ? 'सभी सेवा विधि पूर्ण हुईं — आराध्य का आशीर्वाद लें'
        : 'All offerings complete — rest in quiet devotion';
    }
    if (!activeStep) return '';
    if (hud.heldStepId || hud.pourRate > 0.05) {
      return activeStep.instructionAction[lang];
    }
    return activeStep.instructionHold[lang];
  })();

  const gazeTargetSpec = hud.gazeTargetId
    ? experience.steps.find((s) => s.id === hud.gazeTargetId)
    : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0e0c0a]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div
        ref={mountRef}
        data-testid="ritual-canvas-mount"
        className="absolute inset-0 h-full w-full"
      />

      {/* Normal Mode Smooth Preloading Veil (hides gradient placeholders during 16:9 image decode) */}
      {mode === 'normal' && !assetsReady && (
        <div
          data-testid="scene-loading-veil"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#14100c]/90"
        >
          <div className="rounded-xl border border-amber-500/35 bg-[#1a140f] px-5 py-3 text-center shadow-xl">
            <p className="font-display text-base font-semibold text-amber-100">
              {experience.title[lang]}
            </p>
            <p className="mt-0.5 text-xs text-amber-300/90">
              {lang === 'hi' ? 'पवित्र दर्शन सज्जित हो रहा है…' : 'Preparing sanctum…'}
            </p>
          </div>
        </div>
      )}

      {/* NORMAL SCREEN MODE HUD */}
      {mode === 'normal' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
          {/* Top Bar: Compact Non-Obstructive Devotional Header & Controls */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="pointer-events-auto flex max-w-xs flex-col items-start gap-1.5">
              <div className="w-full rounded-xl border border-[#3e2e1f]/60 bg-[#120d09]/80 px-3 py-2 shadow-lg backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-amber-400">
                  <span className="font-medium tracking-wide uppercase">{experience.traditionLabel[lang]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-[#d6cbb8]">
                    {formatRitualProgress(hud.completedIds.length, experience.steps.length)}{' '}
                    {lang === 'hi' ? 'पूर्ण' : 'Done'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    data-testid="hand-gesture-status"
                    className="inline-flex items-center gap-1 text-amber-300"
                  >
                    <Hand className="h-2.5 w-2.5 text-amber-400" />
                    {gestureLabel}
                  </span>
                </div>
                <h1 className="font-display mt-0.5 text-sm font-semibold leading-tight text-[#faf5ed]">
                  {experience.title[lang]}
                </h1>
                <p className="mt-0.5 text-[11px] leading-snug text-amber-100/90">{promptLine}</p>
                {activeStep?.kind === 'tasbih-count' && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-amber-300">
                    {lang === 'hi' ? 'तस्बीह गणना:' : 'Tasbih Count:'} {hud.tasbihCount} / 33
                  </p>
                )}
              </div>

              {guideOpen && activeStep && (
                <GestureGuideCard
                  lang={lang}
                  activeStep={activeStep}
                  phase={gestureUi.phase}
                  progress={gestureUi.progress}
                  paused={gesturePaused}
                  onTogglePause={() => setGesturePaused((p) => !p)}
                  onCancel={() => cancelGestureRef.current?.()}
                  onPerform={() => {
                    const mgr = managerRef.current;
                    if (!mgr) return;
                    const needsContinuousHold =
                      activeStep.kind === 'pour-water' ||
                      activeStep.kind === 'pour-milk' ||
                      activeStep.kind === 'aarti-wave' ||
                      activeStep.kind === 'chaur-seva';
                    if (needsContinuousHold && hud.heldStepId !== activeStep.id) {
                      mgr.selectAndActivateStep(activeStep.id);
                    } else {
                      mgr.triggerStepAnimatedAction(activeStep.id);
                    }
                  }}
                />
              )}
            </div>

            {/* Top-Right Compact Controls */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              <VirtualHandController
                managerRef={managerRef}
                mode={mode}
                lang={lang}
                handGesture={hud.handGesture}
                heldStepId={hud.heldStepId}
                activeStep={activeStep ?? null}
                guideOpen={guideOpen}
                onToggleGuide={() => setGuideOpen((v) => !v)}
                paused={gesturePaused}
                onGestureUiChange={setGestureUi}
                cancelGestureRef={cancelGestureRef}
              />
              <button
                type="button"
                onClick={onToggleLang}
                aria-label="Toggle language"
                className="inline-flex items-center gap-1 rounded-lg border border-[#3a3025]/70 bg-[#14100c]/85 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:border-amber-500 backdrop-blur-sm cursor-pointer"
              >
                <Globe className="h-3 w-3 text-amber-400" />
                <span>{lang === 'hi' ? 'EN' : 'हिं'}</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="inline-flex items-center justify-center rounded-lg border border-[#3a3025]/70 bg-[#14100c]/85 p-1.5 text-amber-100 hover:border-amber-500 backdrop-blur-sm cursor-pointer"
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-amber-400" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTiltSlider(0);
                  cancelGestureRef.current?.();
                  managerRef.current?.resetRitual();
                }}
                aria-label={lang === 'hi' ? 'पुनः आरंभ करें' : 'Reset ritual'}
                className="inline-flex items-center gap-1 rounded-lg border border-[#3a3025]/70 bg-[#14100c]/85 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:border-amber-500 backdrop-blur-sm cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 text-amber-400" />
                <span className="hidden sm:inline">{lang === 'hi' ? 'पुनः' : 'Reset'}</span>
              </button>
              {typeof navigator !== 'undefined' && 'xr' in navigator && (
                <button
                  type="button"
                  onClick={() => managerRef.current?.requestWebXRSession()}
                  aria-label="Enter Immersive WebXR VR"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/70 bg-amber-950/70 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:border-amber-400 hover:bg-amber-900 backdrop-blur-sm cursor-pointer shadow-md"
                >
                  <Eye className="h-3.5 w-3.5 text-amber-400" />
                  <span>WebXR</span>
                </button>
              )}
              <button
                type="button"
                onClick={onExit}
                aria-label={lang === 'hi' ? 'बाहर निकलें' : 'Exit ritual'}
                className="inline-flex items-center gap-1 rounded-lg border border-[#4a2b24]/80 bg-[#241310]/90 px-2.5 py-1.5 text-xs font-medium text-amber-100 hover:border-amber-400 backdrop-blur-sm cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>{lang === 'hi' ? 'बाहर' : 'Exit'}</span>
              </button>
            </div>
          </div>

          {/* Bottom Collapsible Ritual Dock (Zero Viewport Occlusion) */}
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
            {/* Tactile Kalash Tilt Control when pouring or holding Kalash */}
            {isHoldingPour && (
              <div className="pointer-events-auto mb-2 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-amber-500/40 bg-[#16120e]/95 px-4 py-2 shadow-lg backdrop-blur-md">
                <label
                  htmlFor="kalash-tilt-slider"
                  className="text-xs font-medium text-amber-200 whitespace-nowrap"
                >
                  {lang === 'hi' ? 'कलश झुकाव' : 'Vessel Tilt'}
                </label>
                <input
                  id="kalash-tilt-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(hud.tiltAngleRad > 0.05 ? (hud.tiltAngleRad / 1.38) * 100 : tiltSlider)}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTiltSlider(val);
                    managerRef.current?.setManualTilt(val / 100);
                  }}
                  className="h-1.5 w-36 accent-amber-500 cursor-pointer"
                />
                <span className="w-16 text-right text-xs tabular-nums text-amber-300">
                  {hud.tiltDegrees}° · {Math.round(hud.pourRate * 100)}%
                </span>
                {hud.liquidRemaining !== undefined && (
                  <div className="flex items-center gap-1.5 border-l border-[#3a3025] pl-3 text-xs text-amber-300">
                    <span className="text-[#a89c8c]">{lang === 'hi' ? 'पात्र स्तर:' : 'Volume:'}</span>
                    <span className="font-semibold tabular-nums text-amber-400">
                      {Math.round(hud.liquidRemaining * 100)}%
                    </span>
                    {hud.liquidRemaining <= 0.01 && (
                      <span className="rounded bg-amber-900/80 px-1 py-0.5 text-[10px] font-semibold text-amber-200">
                        {lang === 'hi' ? 'रिक्त' : 'Empty'}
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setTiltSlider(0);
                    managerRef.current?.returnHeldToTray();
                  }}
                  className="rounded-lg border border-[#3a3025] bg-[#221b14] px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:border-amber-400 cursor-pointer"
                >
                  {lang === 'hi' ? 'वापस रखें' : 'Return Vessel'}
                </button>
              </div>
            )}

            {/* Tactile Place / Release Controls when holding an offering */}
            {isHoldingAny && !isHoldingPour && (
              <div className="pointer-events-auto mb-2 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#16120e]/95 px-3.5 py-2 shadow-lg">
                {hud.canPlaceHeld && (
                  <button
                    type="button"
                    data-testid="place-at-altar-btn"
                    onClick={() => managerRef.current?.releaseHeldAtTarget()}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-[#140e08] hover:bg-amber-500 cursor-pointer"
                  >
                    {lang === 'hi' ? 'वेदी पर अर्पित करें' : 'Place on Altar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => managerRef.current?.returnHeldToTray()}
                  className="rounded-lg border border-[#3a3025] bg-[#221b14] px-3 py-1.5 text-xs font-medium text-amber-100 hover:border-amber-400 cursor-pointer"
                >
                  {lang === 'hi' ? 'थाली में रखें' : 'Return to Tray'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDockOpen((v) => !v)}
              aria-label={dockOpen ? 'Hide offering tray' : 'Show offering tray'}
              className="pointer-events-auto mb-1 inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[#3a3025] bg-[#14100c]/95 px-3 py-1 text-[11px] font-medium text-[#d6cbb8] hover:text-amber-200 cursor-pointer"
            >
              {dockOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              <span>
                {dockOpen
                  ? lang === 'hi'
                    ? 'सामग्री छुपाएं · स्पर्श व ड्रैग से अर्पण करें'
                    : 'Hide Offerings · Touch & drag objects in 3D'
                  : lang === 'hi'
                  ? 'पूजा सामग्री'
                  : 'Offerings'}
              </span>
            </button>

            {dockOpen && (
              <div className="pointer-events-auto flex w-full flex-wrap items-center justify-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl border border-[#3a3025]/70 bg-[#120e0a]/85 backdrop-blur-md p-1.5 shadow-xl">
                {experience.steps.map((step) => {
                  const isDone = hud.completedIds.includes(step.id);
                  const isActive = hud.activeStepId === step.id || hud.heldStepId === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => managerRef.current?.selectAndActivateStep(step.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'border-amber-500 bg-amber-600/25 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                          : isDone
                          ? 'border-emerald-700/40 bg-emerald-950/30 text-emerald-300'
                          : 'border-[#2e261d]/80 bg-[#19140f]/90 text-[#cfc4b4] hover:border-amber-500/50 hover:text-amber-100'
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: step.accentHex }}
                        />
                      )}
                      <span>{step.label[lang]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VR HEADSET STEREOSCOPIC MODE OVERLAY */}
      {mode === 'vr' && (
        <div className="pointer-events-none fixed inset-0 z-20">
          {/* Center Split Divider & Soft Optical Vignettes */}
          <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-black" />
          <div className="grid h-full w-full grid-cols-2">
            {[0, 1].map((eyeIdx) => (
              <div
                key={eyeIdx}
                className="relative flex h-full w-full items-center justify-center border-x border-black/80"
                style={{
                  boxShadow: 'inset 0 0 90px 26px rgba(0,0,0,0.78)'
                }}
              >
                {/* Synchronized Gaze Instruction Banner (comfortable eye zone) */}
                <div className="absolute top-14 max-w-[78%] rounded-lg bg-black/70 px-3 py-1.5 text-center text-xs text-amber-100">
                  {gazeTargetSpec
                    ? `${gazeTargetSpec.label[lang]} · ${Math.round(hud.gazeProgress * 100)}%`
                    : promptLine}
                </div>

                {/* Central Gaze Reticle + Radial Dwell Ring */}
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="14"
                      fill="none"
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth="2"
                    />
                    {hud.gazeProgress > 0.02 && (
                      <circle
                        cx="20"
                        cy="20"
                        r="14"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="3"
                        strokeDasharray={2 * Math.PI * 14}
                        strokeDashoffset={2 * Math.PI * 14 * (1 - hud.gazeProgress)}
                      />
                    )}
                  </svg>
                  <div className="absolute h-1.5 w-1.5 rounded-full bg-amber-300" />
                </div>
              </div>
            ))}
          </div>

          {/* VR Top Edge Controls (Recenter, Fallback Note, Sound, Exit) */}
          <div className="pointer-events-auto absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#3a3025] bg-[#14100c]/95 px-3 py-1.5 text-xs">
            <span className="hidden sm:inline text-[#b8ad9d]">
              {hud.sensorActive
                ? lang === 'hi'
                  ? 'हेड ट्रैकिंग सक्रिय'
                  : 'Head Tracking'
                : lang === 'hi'
                ? 'ड्रैग / तीर कुंजी से देखें'
                : 'Drag or Arrows to Look'}
            </span>
            {motionPermissionNeeded && (
              <button
                type="button"
                onClick={handleRequestMotion}
                className="rounded bg-amber-600 px-2 py-1 text-[11px] font-semibold text-[#120d08] cursor-pointer"
              >
                {lang === 'hi' ? 'सेंसर चालू करें' : 'Enable Gyro'}
              </button>
            )}
            <button
              type="button"
              onClick={() => managerRef.current?.recenterVR()}
              aria-label="Recenter VR view"
              className="inline-flex items-center gap-1 rounded bg-[#221b14] px-2.5 py-1 text-amber-200 hover:bg-[#2d241b] cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{lang === 'hi' ? 'रीसेंटर' : 'Recenter'}</span>
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="rounded bg-[#221b14] p-1.5 text-amber-200 hover:bg-[#2d241b] cursor-pointer"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit VR mode"
              className="inline-flex items-center gap-1 rounded bg-[#3b1c17] px-2.5 py-1 text-amber-100 hover:bg-[#52251e] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>{lang === 'hi' ? 'बाहर' : 'Exit'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
