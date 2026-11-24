import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Hand,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  getStepGestureSpec,
  Language,
  RitualObjectSpec,
  ViewMode
} from '../data/experiences';
import {
  computeHandCalibrationSummary,
  HAND_LANDMARK_CONNECTIONS,
  HandCalibrationSummary,
  MappedCameraHand,
  mapLandmarksToHandState
} from '../logic/collisionPhysics';
import {
  cancelGestureAction,
  createInitialGestureState,
  extractHandFeatureFrame,
  GESTURE_DEFINITIONS,
  GesturePhase,
  GestureRecognizerState,
  HandFeatureFrame,
  stepGestureRecognizer
} from '../logic/gestureEngine';
import { HandGestureState } from '../logic/ritualEngine';
import { RitualSceneManager } from '../three/RitualSceneManager';
import { GestureIcon } from './GestureIcon';

export interface GestureUiSnapshot {
  phase: GesturePhase;
  progress: number;
  confidence: number;
}

interface VirtualHandControllerProps {
  managerRef: React.MutableRefObject<RitualSceneManager | null>;
  mode: ViewMode;
  lang: Language;
  handGesture: HandGestureState;
  heldStepId: string | null;
  activeStep: RitualObjectSpec | null;
  guideOpen: boolean;
  onToggleGuide: () => void;
  paused: boolean;
  onGestureUiChange: (ui: GestureUiSnapshot) => void;
  cancelGestureRef: React.MutableRefObject<(() => void) | null>;
}

type CameraTrackingStatus = 'off' | 'initializing' | 'active' | 'fallback';
type RawLandmarkList = Array<{ x: number; y: number; z: number }>;

const MIN_DETECT_INTERVAL_MS = 65; // ~15 Hz low-compute MediaPipe inference cadence
const UI_SYNC_INTERVAL_MS = 160; // <= 6.2 Hz React HUD sync

function smoothCameraHand(
  prev: MappedCameraHand | null,
  next: MappedCameraHand | null,
  alpha = 0.44
): MappedCameraHand | null {
  if (!next || !next.detected) return null;
  if (!prev || !prev.detected) return next;

  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  return {
    detected: true,
    handedness: next.handedness,
    worldPos: {
      x: lerp(prev.worldPos.x, next.worldPos.x),
      y: lerp(prev.worldPos.y, next.worldPos.y),
      z: lerp(prev.worldPos.z, next.worldPos.z)
    },
    gripStrength: lerp(prev.gripStrength, next.gripStrength),
    isPinching: next.isPinching,
    isOpenPalm: next.isOpenPalm,
    wristRollRad: lerp(prev.wristRollRad, next.wristRollRad),
    fingerCurls: {
      thumb: lerp(prev.fingerCurls.thumb, next.fingerCurls.thumb),
      index: lerp(prev.fingerCurls.index, next.fingerCurls.index),
      middle: lerp(prev.fingerCurls.middle, next.fingerCurls.middle),
      ring: lerp(prev.fingerCurls.ring, next.fingerCurls.ring),
      pinky: lerp(prev.fingerCurls.pinky, next.fingerCurls.pinky)
    }
  };
}

function drawHandSkeleton(
  canvas: HTMLCanvasElement | null,
  landmarksPerHand: RawLandmarkList[]
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  for (let hIdx = 0; hIdx < landmarksPerHand.length; hIdx++) {
    const pts = landmarksPerHand[hIdx];
    if (!pts || pts.length < 21) continue;

    ctx.strokeStyle = hIdx === 0 ? '#f59e0b' : '#34d399';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let c = 0; c < HAND_LANDMARK_CONNECTIONS.length; c++) {
      const [a, b] = HAND_LANDMARK_CONNECTIONS[c];
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo((1 - pa.x) * w, pa.y * h);
      ctx.lineTo((1 - pb.x) * w, pb.y * h);
      ctx.stroke();
    }

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
      ctx.fillStyle = isTip ? '#fef3c7' : '#fbbf24';
      ctx.beginPath();
      ctx.arc((1 - p.x) * w, p.y * h, isTip ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const VirtualHandController: React.FC<VirtualHandControllerProps> = ({
  managerRef,
  mode,
  lang,
  activeStep,
  guideOpen,
  onToggleGuide,
  paused,
  onGestureUiChange,
  cancelGestureRef
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const landmarkerRef = useRef<{
    detectForVideo: (
      v: HTMLVideoElement,
      t: number
    ) => {
      landmarks: Array<RawLandmarkList>;
      handedness?: Array<Array<{ categoryName?: string }>>;
    };
    close?: () => void;
  } | null>(null);

  const lastRightRef = useRef<MappedCameraHand | null>(null);
  const lastLeftRef = useRef<MappedCameraHand | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastDetectMsRef = useRef<number>(0);
  const lastUiSyncMsRef = useRef<number>(0);
  const activeStepRef = useRef<RitualObjectSpec | null>(activeStep);
  const recognizerRef = useRef<GestureRecognizerState>(
    createInitialGestureState(activeStep ? getStepGestureSpec(activeStep).gestureId : null)
  );

  const [status, setStatus] = useState<CameraTrackingStatus>('off');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [detectedHandsCount, setDetectedHandsCount] = useState(0);
  const [gestureUi, setGestureUi] = useState<GestureUiSnapshot>({
    phase: 'IDLE',
    progress: 0,
    confidence: 0
  });
  const [summary, setSummary] = useState<HandCalibrationSummary>({
    ready: false,
    detectedSides: [],
    primaryPose: 'none',
    tiltDegrees: 0
  });

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    onGestureUiChange(gestureUi);
  }, [gestureUi, onGestureUiChange]);

  useEffect(() => {
    recognizerRef.current = { ...recognizerRef.current, paused };
    if (paused) {
      managerRef.current?.cancelActiveGesture();
      setGestureUi((prev) => ({ ...prev, phase: 'IDLE', progress: 0 }));
    }
  }, [paused, managerRef]);

  const stopCameraTracking = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (skeletonCanvasRef.current) {
      const ctx = skeletonCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, skeletonCanvasRef.current.width, skeletonCanvasRef.current.height);
    }
    if (landmarkerRef.current) {
      try {
        landmarkerRef.current.close?.();
      } catch {
        // Ignore cleanup errors
      }
      landmarkerRef.current = null;
    }
    lastRightRef.current = null;
    lastLeftRef.current = null;
    lastVideoTimeRef.current = -1;
    lastDetectMsRef.current = 0;
    recognizerRef.current = createInitialGestureState(
      activeStepRef.current ? getStepGestureSpec(activeStepRef.current).gestureId : null,
      false
    );
    setDetectedHandsCount(0);
    setGestureUi({ phase: 'IDLE', progress: 0, confidence: 0 });
    setSummary({ ready: false, detectedSides: [], primaryPose: 'none', tiltDegrees: 0 });
    managerRef.current?.applyCameraHands(null, null);
    setStatus('off');
  }, [managerRef]);

  useEffect(() => {
    if (mode !== 'normal') {
      stopCameraTracking();
      setStatusNote(null);
      setCalibrationOpen(false);
    }
    return () => {
      stopCameraTracking();
    };
  }, [mode, stopCameraTracking]);

  const startCameraTracking = async () => {
    if (mode !== 'normal') return;
    if (status === 'active' || status === 'initializing') {
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('fallback');
      setStatusNote(
        lang === 'hi'
          ? 'कैमरा उपलब्ध नहीं — टच और ड्रैग उपयोग करें'
          : 'Camera unavailable — using touch & drag'
      );
      return;
    }

    setStatus('initializing');
    setStatusNote(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 360 }
        },
        audio: false
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stopCameraTracking();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const visionMod = await import('@mediapipe/tasks-vision');
      const vision = await visionMod.FilesetResolver.forVisionTasks('/mediapipe/wasm');
      const modelUrl =
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      let landmarker;
      try {
        landmarker = await visionMod.HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2
        });
      } catch {
        landmarker = await visionMod.HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 2
        });
      }

      landmarkerRef.current = landmarker;
      setStatus('active');

      const stepKinematics = () => {
        const v = videoRef.current;
        const lm = landmarkerRef.current;
        if (!v || !lm || !streamRef.current) return;

        const nowMs = performance.now();
        const elapsedSinceDetect = nowMs - lastDetectMsRef.current;

        if (
          elapsedSinceDetect >= MIN_DETECT_INTERVAL_MS &&
          v.readyState >= 2 &&
          v.currentTime !== lastVideoTimeRef.current
        ) {
          lastVideoTimeRef.current = v.currentTime;
          const dtMs = lastDetectMsRef.current > 0 ? elapsedSinceDetect : MIN_DETECT_INTERVAL_MS;
          lastDetectMsRef.current = nowMs;

          try {
            const res = lm.detectForVideo(v, nowMs);
            const allLandmarks = res.landmarks ?? [];
            const total = allLandmarks.length;

            drawHandSkeleton(skeletonCanvasRef.current, allLandmarks);

            let rawRight: MappedCameraHand | null = null;
            let rawLeft: MappedCameraHand | null = null;
            let featRight: HandFeatureFrame | null = null;
            let featLeft: HandFeatureFrame | null = null;

            for (let i = 0; i < total; i++) {
              const pts = allLandmarks[i];
              const rawCat = res.handedness?.[i]?.[0]?.categoryName;
              const logicalSide: 'Left' | 'Right' =
                rawCat === 'Left' ? 'Right' : rawCat === 'Right' ? 'Left' : i === 0 ? 'Right' : 'Left';

              const mapped = mapLandmarksToHandState(pts, logicalSide);
              const feat = extractHandFeatureFrame(pts, logicalSide);
              if (logicalSide === 'Right' && !rawRight) {
                rawRight = mapped;
                featRight = feat;
              } else if (logicalSide === 'Left' && !rawLeft) {
                rawLeft = mapped;
                featLeft = feat;
              } else if (!rawRight) {
                rawRight = mapped;
                featRight = feat;
              }
            }

            const smoothedRight = smoothCameraHand(lastRightRef.current, rawRight, 0.44);
            const smoothedLeft = smoothCameraHand(lastLeftRef.current, rawLeft, 0.44);
            lastRightRef.current = smoothedRight;
            lastLeftRef.current = smoothedLeft;
            managerRef.current?.applyCameraHands(smoothedRight, smoothedLeft);

            // Step active-step-only gesture state machine cleanly outside React render
            const curStep = activeStepRef.current;
            const curGestureId = curStep ? getStepGestureSpec(curStep).gestureId : null;
            const pourDone = curStep ? Boolean(managerRef.current?.isPourStepComplete(curStep.id)) : false;

            const stepOut = stepGestureRecognizer(
              recognizerRef.current,
              curGestureId,
              featLeft,
              featRight,
              dtMs,
              { pourStepComplete: pourDone }
            );
            recognizerRef.current = stepOut.state;
            managerRef.current?.applyGestureOutput(
              stepOut,
              curStep?.id ?? null,
              curGestureId
            );

            // Sync lightweight React HUD only on phase/hand-count change or <= 6 Hz
            const prevUiPhase = gestureUiRefPhase.current;
            const prevHandsCount = detectedHandsRefCount.current;
            if (
              stepOut.state.phase !== prevUiPhase ||
              total !== prevHandsCount ||
              nowMs - lastUiSyncMsRef.current >= UI_SYNC_INTERVAL_MS
            ) {
              gestureUiRefPhase.current = stepOut.state.phase;
              detectedHandsRefCount.current = total;
              lastUiSyncMsRef.current = nowMs;
              setDetectedHandsCount(total);
              setSummary(computeHandCalibrationSummary(smoothedRight, smoothedLeft));
              setGestureUi({
                phase: stepOut.state.phase,
                progress: stepOut.state.actionProgress,
                confidence: stepOut.state.confidence
              });
            }
          } catch {
            // Keep smooth loop alive on transient video frame decode issues
          }
        }
        rafRef.current = requestAnimationFrame(stepKinematics);
      };

      rafRef.current = requestAnimationFrame(stepKinematics);
    } catch {
      stopCameraTracking();
      setStatus('fallback');
      setStatusNote(
        lang === 'hi'
          ? 'कैमरा अनुमति नहीं मिली — टच और ड्रैग उपयोग करें'
          : 'Camera unavailable — using touch & drag'
      );
    }
  };

  const gestureUiRefPhase = useRef<GesturePhase>('IDLE');
  const detectedHandsRefCount = useRef<number>(0);

  const handleCancelCurrentGesture = useCallback(() => {
    recognizerRef.current = cancelGestureAction(recognizerRef.current);
    managerRef.current?.cancelActiveGesture();
    setGestureUi({ phase: 'COOLDOWN', progress: 0, confidence: 0 });
  }, [managerRef]);

  useEffect(() => {
    cancelGestureRef.current = handleCancelCurrentGesture;
    return () => {
      cancelGestureRef.current = null;
    };
  }, [cancelGestureRef, handleCancelCurrentGesture]);

  if (mode !== 'normal') {
    return null;
  }

  const activeGestureSpec = activeStep ? getStepGestureSpec(activeStep) : null;
  const activeGestureDef = activeGestureSpec
    ? GESTURE_DEFINITIONS[activeGestureSpec.gestureId]
    : null;

  const phaseText = getGesturePhaseLabel(lang, paused, gestureUi.phase);

  const cameraButtonLabel = (() => {
    if (status === 'initializing') {
      return lang === 'hi' ? 'तैयार हो रहा...' : 'Starting...';
    }
    if (status === 'active') {
      if (detectedHandsCount === 0) {
        return lang === 'hi' ? 'कैमरा तैयार · 0 हाथ' : 'Camera Ready · 0 Hands';
      }
      return lang === 'hi'
        ? `${detectedHandsCount} हाथ ट्रैक`
        : `${detectedHandsCount} Hand${detectedHandsCount > 1 ? 's' : ''} Tracked`;
    }
    if (status === 'fallback') {
      return lang === 'hi' ? 'टच मोड' : 'Touch Mode';
    }
    return lang === 'hi' ? 'हाथ कैमरा' : 'Hand Camera';
  })();

  const poseLabel = (() => {
    if (summary.primaryPose === 'pinch') return lang === 'hi' ? 'चुटकी / पकड़' : 'Pinch / Grip';
    if (summary.primaryPose === 'open') return lang === 'hi' ? 'खुला हाथ' : 'Open Palm';
    if (summary.primaryPose === 'relaxed') return lang === 'hi' ? 'हाथ सक्रिय' : 'Hand Steady';
    return lang === 'hi' ? 'कोई हाथ नहीं' : 'No Hands Detected';
  })();

  return (
    <>
      <div className="pointer-events-auto flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="hand-camera-btn"
            onClick={() => {
              setCalibrationOpen(true);
              if (status === 'off' || status === 'fallback') {
                void startCameraTracking();
              }
            }}
            aria-label={lang === 'hi' ? 'हाथ कैमरा ट्रैकिंग व कैलिब्रेशन' : 'Hand Camera & Calibration'}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
              status === 'active' && detectedHandsCount > 0
                ? 'border-emerald-500/75 bg-emerald-950/90 text-emerald-100'
                : status === 'active'
                ? 'border-amber-500/75 bg-[#20180f]/95 text-amber-100'
                : 'border-[#3a3025] bg-[#14100c]/90 text-amber-100 hover:border-amber-500'
            }`}
          >
            {status === 'active' ? (
              <Camera
                className={`h-3.5 w-3.5 ${
                  detectedHandsCount > 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
            ) : (
              <CameraOff className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span>{cameraButtonLabel}</span>
          </button>

          {activeStep && activeGestureSpec && activeGestureDef && (
            <button
              type="button"
              data-testid="toggle-gesture-guide-btn"
              onClick={onToggleGuide}
              aria-label={lang === 'hi' ? 'मुद्रा मार्गदर्शिका' : 'Gesture Guide'}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-medium cursor-pointer transition-colors ${
                guideOpen
                  ? 'border-amber-500/60 bg-[#1e1710]/95 text-amber-200'
                  : 'border-[#3a3025] bg-[#14100c]/90 text-[#d6cbb8] hover:border-amber-500'
              }`}
            >
              <Hand className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">{lang === 'hi' ? 'मुद्रा' : 'Guide'}</span>
            </button>
          )}
        </div>

        {!calibrationOpen && statusNote && (
          <div
            data-testid="hand-camera-fallback"
            className="max-w-[240px] rounded-md border border-[#3a3025] bg-[#14100c]/95 px-2.5 py-1 text-[11px] text-amber-200 shadow-md"
          >
            {statusNote}
          </div>
        )}
      </div>

      {/* Persistent video + landmark canvas host (Calibration Modal or compact bottom-right PiP) */}
      <div
        className={
          calibrationOpen
            ? 'pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4'
            : status === 'active'
            ? 'pointer-events-auto fixed bottom-24 right-4 z-20 w-40 overflow-hidden rounded-xl border border-amber-500/50 bg-[#14100c] shadow-xl'
            : 'pointer-events-none fixed opacity-0 h-0 w-0 overflow-hidden'
        }
      >
        <div
          data-testid={calibrationOpen ? 'hand-calibration-panel' : undefined}
          className={
            calibrationOpen
              ? 'w-full max-w-2xl overflow-hidden rounded-2xl border border-[#3f3224] bg-[#16120e] text-[#f5efe6] shadow-2xl'
              : 'w-full'
          }
        >
          {calibrationOpen && (
            <div className="flex items-center justify-between border-b border-[#2c2319] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-400" />
                <h2 className="font-display text-lg font-semibold text-[#faf4eb]">
                  {lang === 'hi' ? 'हाथ मुद्रा कैमरा कैलिब्रेशन' : 'Hand Gesture Camera & Calibration'}
                </h2>
              </div>
              <button
                type="button"
                data-testid="close-calibration-btn"
                onClick={() => setCalibrationOpen(false)}
                aria-label={lang === 'hi' ? 'कैलिब्रेशन बंद करें' : 'Close calibration'}
                className="rounded-lg border border-[#3a3025] bg-[#211a13] p-1.5 text-amber-200 hover:border-amber-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className={calibrationOpen ? 'grid gap-4 p-5 md:grid-cols-2' : ''}>
            <div
              className={
                calibrationOpen
                  ? 'relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#3a3025] bg-[#0d0a08]'
                  : 'relative h-28 w-full overflow-hidden bg-[#0d0a08]'
              }
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
              <canvas
                ref={skeletonCanvasRef}
                width={480}
                height={360}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />

              {calibrationOpen && status !== 'active' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#120e0b]/92 px-4 text-center">
                  <CameraOff className="mb-2 h-8 w-8 text-amber-400/80" />
                  <p
                    data-testid="hand-camera-fallback"
                    className="text-xs font-medium text-amber-100"
                  >
                    {status === 'initializing'
                      ? lang === 'hi'
                        ? 'कैमरा व 21-बिंदु मुद्रा मॉडल तैयार हो रहा है...'
                        : 'Starting camera & low-compute 21-landmark tracker...'
                      : statusNote ??
                        (lang === 'hi'
                          ? 'कैमरा अनुमति दें या नीचे टच और ड्रैग विकल्प चुनें'
                          : 'Allow camera access or continue seamlessly with touch & drag')}
                  </p>
                </div>
              )}

              {status === 'active' && (
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-between bg-[#14100c]/92 px-2.5 py-1 text-[10px] text-amber-200">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2
                      className={`h-3 w-3 ${
                        detectedHandsCount > 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    {detectedHandsCount > 0
                      ? lang === 'hi'
                        ? `${detectedHandsCount} हाथ ट्रैक`
                        : `${detectedHandsCount} Hand${detectedHandsCount > 1 ? 's' : ''}`
                      : lang === 'hi'
                      ? 'हाथ फ्रेम में लाएं'
                      : 'Place hands in view'}
                  </span>
                  <span className="text-amber-300">{phaseText}</span>
                </div>
              )}
            </div>

            {calibrationOpen && (
              <div className="flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    {lang === 'hi' ? 'सटीक मुद्रा पहचान मार्गदर्शिका' : 'Camera & Gesture Setup'}
                  </p>
                  <ul className="space-y-1.5 text-xs leading-relaxed text-[#d7cbb8]">
                    <li>
                      {lang === 'hi'
                        ? '• कैमरा को हल्का नीचे की ओर रखें ताकि मेज़ के ऊपर आपके दोनों हाथ स्पष्ट दिखें।'
                        : '• Angle your webcam gently toward your chest/desk so both hands stay clearly framed.'}
                    </li>
                    <li>
                      {lang === 'hi'
                        ? '• प्रत्येक मुद्रा को 0.3 सेकंड स्थिर रखें — झूठी गति से बचाव स्वतः लागू है।'
                        : '• Hold each gesture briefly (~0.3s) to confirm — stray hand movements will not false-trigger.'}
                    </li>
                  </ul>

                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2f261c] bg-[#110d0a] p-2.5 text-[11px]">
                    <div>
                      <div className="text-[#9e907e]">{lang === 'hi' ? 'पुष्प / ध्यान' : 'Flowers'}</div>
                      <div className="font-medium text-amber-200">
                        {lang === 'hi' ? 'नमस्ते झुकाएं' : 'Namaste Dip'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#9e907e]">{lang === 'hi' ? 'अभिषेक' : 'Pour'}</div>
                      <div className="font-medium text-amber-200">
                        {lang === 'hi' ? 'मुट्ठी + झुकाव' : 'Grip + Tilt'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#9e907e]">{lang === 'hi' ? 'भोग / आरती' : 'Bhog / Aarti'}</div>
                      <div className="font-medium text-amber-200">
                        {lang === 'hi' ? 'अंजलि / वृत्त' : 'Cup / Circle'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2e241a] bg-[#1a140f] px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[#e6dac8]">
                      <Hand className="h-3.5 w-3.5 text-amber-400" />
                      {summary.ready
                        ? `${summary.detectedSides.join(' + ')} · ${poseLabel} · ${phaseText}`
                        : poseLabel}
                    </span>
                    <span className="tabular-nums text-amber-300">
                      {lang === 'hi' ? 'झुकाव:' : 'Tilt:'} {summary.tiltDegrees}°
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {status === 'active' ? (
                    <button
                      type="button"
                      data-testid="stop-camera-btn"
                      onClick={() => {
                        stopCameraTracking();
                        setCalibrationOpen(false);
                      }}
                      className="rounded-lg border border-[#4a2e25] bg-[#241511] px-3 py-2 text-xs font-medium text-amber-100 hover:border-amber-400 cursor-pointer"
                    >
                      {lang === 'hi' ? 'कैमरा बंद करें' : 'Turn Off Camera'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCameraTracking()}
                      disabled={status === 'initializing'}
                      className="rounded-lg border border-[#3a3025] bg-[#211a13] px-3 py-2 text-xs font-medium text-amber-100 hover:border-amber-400 cursor-pointer"
                    >
                      {lang === 'hi' ? 'कैमरा पुनः प्रयास करें' : 'Retry Camera'}
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="continue-ritual-btn"
                    onClick={() => setCalibrationOpen(false)}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-[#140e08] hover:bg-amber-500 cursor-pointer"
                  >
                    {status === 'active'
                      ? lang === 'hi'
                        ? 'पूजा पर लौटें'
                        : 'Continue to Ritual'
                      : lang === 'hi'
                      ? 'टच व ड्रैग से जारी रखें'
                      : 'Use Touch & Drag Instead'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

function getGesturePhaseLabel(lang: Language, paused: boolean, phase: GesturePhase): string {
  if (paused) return lang === 'hi' ? 'मुद्रा विराम' : 'Gestures Paused';
  if (phase === 'DETECTED') return lang === 'hi' ? 'मुद्रा पहचानी' : 'Gesture Detected';
  if (phase === 'CONFIRMATION') return lang === 'hi' ? 'स्थिर रखें…' : 'Hold Steady…';
  if (phase === 'ACTION') return lang === 'hi' ? 'क्रिया सक्रिय' : 'Action Active';
  if (phase === 'COMPLETED') return lang === 'hi' ? 'पूर्ण' : 'Completed';
  if (phase === 'COOLDOWN') return lang === 'hi' ? 'तैयार हो रहा…' : 'Ready Soon…';
  return lang === 'hi' ? 'मुद्रा प्रतीक्षित' : 'Ready for Gesture';
}

interface GestureGuideCardProps {
  lang: Language;
  activeStep: RitualObjectSpec;
  phase: GesturePhase;
  progress: number;
  paused: boolean;
  onTogglePause: () => void;
  onCancel: () => void;
  onPerform: () => void;
}

export const GestureGuideCard: React.FC<GestureGuideCardProps> = ({
  lang,
  activeStep,
  phase,
  progress,
  paused,
  onTogglePause,
  onCancel,
  onPerform
}) => {
  const activeGestureSpec = getStepGestureSpec(activeStep);
  const activeGestureDef = GESTURE_DEFINITIONS[activeGestureSpec.gestureId];
  const phaseText = getGesturePhaseLabel(lang, paused, phase);

  return (
    <div
      data-testid="gesture-guide-card"
      className="w-72 max-w-full rounded-xl border border-[#3a3025] bg-[#14100c]/92 p-2.5 text-left shadow-xl"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-[#211911] text-amber-300">
          <GestureIcon iconKey={activeGestureDef.iconKey} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[11px] font-semibold text-amber-200">
              {activeStep.label[lang]}
            </span>
            <span
              data-testid="gesture-phase-label"
              className={`shrink-0 text-[10px] font-medium ${
                phase === 'ACTION'
                  ? 'text-emerald-300'
                  : phase === 'DETECTED' || phase === 'CONFIRMATION'
                  ? 'text-amber-300'
                  : 'text-[#a89a87]'
              }`}
            >
              {phaseText}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#ddd1c0]">
            {activeGestureSpec.hint[lang]}
          </p>
        </div>
      </div>

      {(phase === 'CONFIRMATION' || phase === 'ACTION') && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#2a2118]">
          <div
            className="h-full bg-amber-400 transition-all duration-150"
            style={{ width: `${Math.round(Math.max(0.08, progress) * 100)}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-[#282017] pt-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="gesture-pause-btn"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1 rounded border border-[#3a3025] bg-[#1c1610] px-2 py-1 text-[10px] font-medium text-[#dfd3c3] hover:border-amber-500 cursor-pointer"
          >
            {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
            <span>{paused ? (lang === 'hi' ? 'चालू' : 'Resume') : lang === 'hi' ? 'रोकें' : 'Pause'}</span>
          </button>
          <button
            type="button"
            data-testid="gesture-cancel-btn"
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded border border-[#3a3025] bg-[#1c1610] px-2 py-1 text-[10px] font-medium text-[#dfd3c3] hover:border-amber-500 cursor-pointer"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>{lang === 'hi' ? 'रद्द' : 'Cancel'}</span>
          </button>
        </div>
        <button
          type="button"
          data-testid="perform-active-step-btn"
          onClick={onPerform}
          className="rounded bg-amber-600/90 px-2.5 py-1 text-[10px] font-semibold text-[#140e08] hover:bg-amber-500 cursor-pointer"
        >
          {lang === 'hi' ? 'अर्पित करें' : 'Perform'}
        </button>
      </div>
    </div>
  );
};
