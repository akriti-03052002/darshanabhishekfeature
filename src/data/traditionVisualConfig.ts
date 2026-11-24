import type { ExperienceId, ViewMode } from './experiences';

export type AltarSurfaceKind = 'dark-basalt' | 'makrana-marble' | 'carved-teak' | 'walnut-teak';

export interface TraditionRunnerStyle {
  colorHex: number;
  trimHex: number;
  useBrocade: boolean;
}

export interface TraditionLightingSpec {
  sceneBgHex: number;
  fogHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  keyColorHex: number;
  keyIntensity: number;
  keyPos: [number, number, number];
  rimColorHex: number;
  rimIntensity: number;
  backdropBrightness: number;
}

export interface TraditionVisualConfig {
  id: ExperienceId;
  altarSurface: AltarSurfaceKind;
  runnerStyle: TraditionRunnerStyle;
  lighting: TraditionLightingSpec;
  panoramaYCenter: number;
}

export const TRADITION_VISUAL_CONFIGS: Record<ExperienceId, TraditionVisualConfig> = {
  shiva: {
    id: 'shiva',
    altarSurface: 'dark-basalt',
    runnerStyle: { colorHex: 0x6b1418, trimHex: 0xd4a348, useBrocade: true },
    lighting: {
      sceneBgHex: 0x16110d,
      fogHex: 0x16110d,
      fogDensity: 0.035,
      hemiSkyHex: 0xfbf8f2,
      hemiGroundHex: 0x4b3f35,
      hemiIntensity: 0.78,
      keyColorHex: 0xffebd1,
      keyIntensity: 1.28,
      keyPos: [1.15, 2.3, 1.75],
      rimColorHex: 0x9bb8d6,
      rimIntensity: 0.44,
      backdropBrightness: 0.86
    },
    panoramaYCenter: -0.04
  },
  krishna: {
    id: 'krishna',
    altarSurface: 'makrana-marble',
    runnerStyle: { colorHex: 0x7a1226, trimHex: 0xfbbf24, useBrocade: true },
    lighting: {
      sceneBgHex: 0x18120e,
      fogHex: 0x18120e,
      fogDensity: 0.03,
      hemiSkyHex: 0xfffaf2,
      hemiGroundHex: 0x62503e,
      hemiIntensity: 0.82,
      keyColorHex: 0xfff0d6,
      keyIntensity: 1.26,
      keyPos: [1.2, 2.35, 1.75],
      rimColorHex: 0xa3c0e0,
      rimIntensity: 0.42,
      backdropBrightness: 0.9
    },
    panoramaYCenter: -0.1
  },
  balaji: {
    id: 'balaji',
    altarSurface: 'makrana-marble',
    runnerStyle: { colorHex: 0x9c2810, trimHex: 0xf59e0b, useBrocade: true },
    lighting: {
      sceneBgHex: 0x1c140e,
      fogHex: 0x1c140e,
      fogDensity: 0.03,
      hemiSkyHex: 0xfffaf0,
      hemiGroundHex: 0x6e5946,
      hemiIntensity: 0.84,
      keyColorHex: 0xffeed4,
      keyIntensity: 1.25,
      keyPos: [1.1, 2.35, 1.8],
      rimColorHex: 0xc2d4e8,
      rimIntensity: 0.4,
      backdropBrightness: 0.9
    },
    panoramaYCenter: -0.09
  },
  durga: {
    id: 'durga',
    altarSurface: 'makrana-marble',
    runnerStyle: { colorHex: 0x7a1216, trimHex: 0xf59e0b, useBrocade: true },
    lighting: {
      sceneBgHex: 0x1b130f,
      fogHex: 0x1b130f,
      fogDensity: 0.03,
      hemiSkyHex: 0xfffbf4,
      hemiGroundHex: 0x6e5c4c,
      hemiIntensity: 0.86,
      keyColorHex: 0xfff3de,
      keyIntensity: 1.28,
      keyPos: [1.3, 2.35, 1.7],
      rimColorHex: 0xcbdcf0,
      rimIntensity: 0.42,
      backdropBrightness: 0.9
    },
    panoramaYCenter: -0.14
  },
  buddha: {
    id: 'buddha',
    altarSurface: 'carved-teak',
    runnerStyle: { colorHex: 0x805731, trimHex: 0xc9a468, useBrocade: false },
    lighting: {
      sceneBgHex: 0x161411,
      fogHex: 0x161411,
      fogDensity: 0.03,
      hemiSkyHex: 0xfdfcf9,
      hemiGroundHex: 0x524234,
      hemiIntensity: 0.82,
      keyColorHex: 0xfff7e8,
      keyIntensity: 1.24,
      keyPos: [-1.25, 2.25, 1.75],
      rimColorHex: 0xb3cce0,
      rimIntensity: 0.45,
      backdropBrightness: 0.9
    },
    panoramaYCenter: -0.18
  },
  sikh: {
    id: 'sikh',
    altarSurface: 'makrana-marble',
    runnerStyle: { colorHex: 0x162d6b, trimHex: 0xeab308, useBrocade: true },
    lighting: {
      sceneBgHex: 0x22201d,
      fogHex: 0x22201d,
      fogDensity: 0.025,
      hemiSkyHex: 0xffffff,
      hemiGroundHex: 0x7c7468,
      hemiIntensity: 0.92,
      keyColorHex: 0xfffcf5,
      keyIntensity: 1.22,
      keyPos: [1.1, 2.45, 1.85],
      rimColorHex: 0xd0e0f5,
      rimIntensity: 0.48,
      backdropBrightness: 0.92
    },
    panoramaYCenter: -0.07
  },
  christian: {
    id: 'christian',
    altarSurface: 'walnut-teak',
    runnerStyle: { colorHex: 0xf2ece1, trimHex: 0xc59b45, useBrocade: false },
    lighting: {
      sceneBgHex: 0x171512,
      fogHex: 0x171512,
      fogDensity: 0.03,
      hemiSkyHex: 0xfffef8,
      hemiGroundHex: 0x625648,
      hemiIntensity: 0.86,
      keyColorHex: 0xfff6e3,
      keyIntensity: 1.24,
      keyPos: [1.25, 2.35, 1.7],
      rimColorHex: 0xbdd5ef,
      rimIntensity: 0.46,
      backdropBrightness: 0.9
    },
    panoramaYCenter: -0.08
  },
  islamic: {
    id: 'islamic',
    altarSurface: 'makrana-marble',
    runnerStyle: { colorHex: 0x054d39, trimHex: 0xd4a348, useBrocade: true },
    lighting: {
      sceneBgHex: 0x181a17,
      fogHex: 0x181a17,
      fogDensity: 0.03,
      hemiSkyHex: 0xfffcf4,
      hemiGroundHex: 0x6d695e,
      hemiIntensity: 0.88,
      keyColorHex: 0xfff3d9,
      keyIntensity: 1.24,
      keyPos: [1.3, 2.3, 1.65],
      rimColorHex: 0xc9e0d6,
      rimIntensity: 0.44,
      backdropBrightness: 0.9
    },
    panoramaYCenter: -0.06
  },
  mahavir: {
    id: 'mahavir',
    altarSurface: 'makrana-marble',
    runnerStyle: { colorHex: 0xf0e1c4, trimHex: 0xd97706, useBrocade: true },
    lighting: {
      sceneBgHex: 0x201f1d,
      fogHex: 0x201f1d,
      fogDensity: 0.025,
      hemiSkyHex: 0xffffff,
      hemiGroundHex: 0x7b756b,
      hemiIntensity: 0.9,
      keyColorHex: 0xfffcf4,
      keyIntensity: 1.22,
      keyPos: [-1.15, 2.4, 1.8],
      rimColorHex: 0xd5e2f2,
      rimIntensity: 0.44,
      backdropBrightness: 0.92
    },
    panoramaYCenter: -0.1
  }
};

export interface EnvironmentLightingProfile {
  expId: ExperienceId;
  mode: ViewMode;
  sceneBgHex: number;
  fogHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  keyColorHex: number;
  keyIntensity: number;
  keyPos: [number, number, number];
  rimColorHex: number;
  rimIntensity: number;
  backdropBrightness: number;
  envMapIntensity: number;
  iblDomeEmissiveIntensity: number;
  cameraLookAt: [number, number, number];
}

export function getEnvironmentLightingProfile(
  expId: ExperienceId,
  mode: ViewMode,
  isSoftwareGl = false
): EnvironmentLightingProfile {
  if (mode === 'vr') {
    return {
      expId,
      mode: 'vr',
      sceneBgHex: 0x261d16,
      fogHex: 0x261d16,
      fogDensity: 0.08,
      hemiSkyHex: 0xfefcf7,
      hemiGroundHex: 0x6f5d4d,
      hemiIntensity: isSoftwareGl ? 0.92 : 0.78,
      keyColorHex: 0xfff6e8,
      keyIntensity: 1.24,
      keyPos: [1.25, 2.35, 1.75],
      rimColorHex: 0xc8dbf0,
      rimIntensity: 0.44,
      backdropBrightness: 0.88,
      envMapIntensity: 1.0,
      iblDomeEmissiveIntensity: 0.8,
      cameraLookAt: [0, 0.22, 0.04]
    };
  }

  const cfg = TRADITION_VISUAL_CONFIGS[expId];
  return {
    expId,
    mode: 'normal',
    ...cfg.lighting,
    hemiIntensity: isSoftwareGl
      ? Math.min(1.02, cfg.lighting.hemiIntensity + 0.12)
      : cfg.lighting.hemiIntensity,
    envMapIntensity: 0.92,
    iblDomeEmissiveIntensity: Math.min(1.15, cfg.lighting.backdropBrightness + 0.16),
    cameraLookAt: [0, 0.28, -0.04]
  };
}
