// src/data/assetManifest.ts

import type { ExperienceId } from './experiences';
import { TRADITION_VISUAL_CONFIGS } from './traditionVisualConfig';
import type { TraditionVisualConfig } from './traditionVisualConfig';

/**
 * Macro photographic textures used for realistic PBR surface upgrades in proceduralTextures.ts.
 */
export const PHOTO_MACRO_TEXTURES = {
  marbleAltarUrl: '/src/assets/images/sanctum_marble_tile_1794918170349.jpg',
  sacredLeafUrl: '/src/assets/images/silk_pooja_vastra_1794919880925.jpg',
  floralPetalsUrl: '/src/assets/images/silk_pooja_vastra_1794919880925.jpg',
  edibleSweetsUrl: '/src/assets/images/carved_teak_wood_1794918169920.jpg'
};

export const PANORAMA_CARD_MAP: Record<string, string> = {
  shiva: '/src/assets/images/shiva_abhishek_card_1794915122107.jpg',
  krishna: '/src/assets/images/krishna_makhan_card_1794915123507.jpg',
  balaji: '/src/assets/images/salasar_balaji_card_1794915123986.jpg',
  durga: '/src/assets/images/maa_durga_card_1794915124368.jpg',
  buddha: '/src/assets/images/buddha_seva_card_1794915125152.jpg',
  sikh: '/src/assets/images/sikh_seva_card_1794915125441.jpg',
  christian: '/src/assets/images/christian_prayer_card_1794915125810.jpg',
  islamic: '/src/assets/images/islamic_ziyarat_card_1794915126893.jpg',
  mahavir: '/src/assets/images/mahavir_swami_card_1794915127191.jpg'
};

export interface TraditionVisualAsset extends TraditionVisualConfig {
  envPanoramaUrl: string;
}

/**
 * Returns complete visual configuration & panorama asset URL for a given tradition.
 */
export function getTraditionVisualAsset(id: ExperienceId): TraditionVisualAsset {
  const cfg = TRADITION_VISUAL_CONFIGS[id] || TRADITION_VISUAL_CONFIGS.shiva;
  const panoUrl = PANORAMA_CARD_MAP[id] || PANORAMA_CARD_MAP.shiva;
  return {
    ...cfg,
    envPanoramaUrl: panoUrl
  };
}

/**
 * Asset specification for 3D GLTF/GLB models, HDR environments, and textures.
 */
export interface AssetSpec {
  environmentModel: string;
  environmentHDR?: string;
  deityModel: string;
  objects: Record<string, string>;
  textures?: Record<string, string>;
}

export const assetManifest: Record<string, AssetSpec> = {
  shiva: {
    environmentModel: '/assets/environments/shiva/scene.glb',
    environmentHDR: '/assets/environments/shiva/hdr.exr',
    deityModel: '/assets/deities/shiva/lingam.glb',
    objects: {
      kalash: '/assets/objects/brassKalash.glb',
      bilvaLeaf: '/assets/objects/bilvaLeaf.glb',
      flowerCluster: '/assets/objects/flowerCluster.glb',
      aartiThali: '/assets/objects/aartiThali.glb',
      bhogPlate: '/assets/objects/bhogPlate.glb'
    },
    textures: {
      brassAlbedo: '/assets/textures/brass_albedo.jpg',
      brassRoughness: '/assets/textures/brass_roughness.jpg',
      brassMetallic: '/assets/textures/brass_metallic.jpg',
      stoneAlbedo: '/assets/textures/stone_albedo.jpg',
      stoneRoughness: '/assets/textures/stone_roughness.jpg'
    }
  },
  krishna: {
    environmentModel: '/assets/environments/krishna/scene.glb',
    environmentHDR: '/assets/environments/krishna/hdr.exr',
    deityModel: '/assets/deities/krishna/figure.glb',
    objects: {
      kalash: '/assets/objects/brassKalash.glb',
      makhanScoop: '/assets/objects/makhanScoop.glb',
      mishriCrystals: '/assets/objects/mishriCrystals.glb',
      flowerLotus: '/assets/objects/flowerLotus.glb',
      aartiThali: '/assets/objects/aartiThali.glb'
    }
  },
  balaji: {
    environmentModel: '/assets/environments/balaji/scene.glb',
    environmentHDR: '/assets/environments/balaji/hdr.exr',
    deityModel: '/assets/deities/balaji/figure.glb',
    objects: {
      kalash: '/assets/objects/brassKalash.glb',
      flowerCluster: '/assets/objects/flowerCluster.glb',
      bhogPlate: '/assets/objects/bhogPlate.glb'
    }
  },
  durga: {
    environmentModel: '/assets/environments/durga/scene.glb',
    environmentHDR: '/assets/environments/durga/hdr.exr',
    deityModel: '/assets/deities/durga/figure.glb',
    objects: {
      kalash: '/assets/objects/brassKalash.glb',
      flowerCluster: '/assets/objects/flowerCluster.glb',
      bhogPlate: '/assets/objects/bhogPlate.glb'
    }
  },
  buddha: {
    environmentModel: '/assets/environments/buddha/scene.glb',
    environmentHDR: '/assets/environments/buddha/hdr.exr',
    deityModel: '/assets/deities/buddha/figure.glb',
    objects: {
      incenseHolder: '/assets/objects/incenseHolder.glb',
      offeringBowl: '/assets/objects/offeringBowl.glb',
      flowerLotus: '/assets/objects/flowerLotus.glb'
    }
  },
  sikh: {
    environmentModel: '/assets/environments/gurudwara/scene.glb',
    environmentHDR: '/assets/environments/gurudwara/hdr.exr',
    deityModel: '/assets/deities/sikh/guruGranthGlobe.glb',
    objects: {
      waterBowl: '/assets/objects/waterBowl.glb',
      offeringPlate: '/assets/objects/offeringPlate.glb'
    }
  },
  christian: {
    environmentModel: '/assets/environments/church/scene.glb',
    environmentHDR: '/assets/environments/church/hdr.exr',
    deityModel: '/assets/deities/church/cross.glb',
    objects: {
      candle: '/assets/objects/candle.glb',
      flowerWreath: '/assets/objects/flowerWreath.glb',
      bible: '/assets/objects/bible.glb'
    }
  },
  islamic: {
    environmentModel: '/assets/environments/masjid/scene.glb',
    environmentHDR: '/assets/environments/masjid/hdr.exr',
    deityModel: '/assets/deities/masjid/quranStand.glb',
    objects: {
      prayerMat: '/assets/objects/prayerMat.glb',
      incenseBurner: '/assets/objects/incenseBurner.glb'
    }
  },
  mahavir: {
    environmentModel: '/assets/environments/jain/scene.glb',
    environmentHDR: '/assets/environments/jain/hdr.exr',
    deityModel: '/assets/deities/jain/templeGlobe.glb',
    objects: {
      kalash: '/assets/objects/brassKalash.glb',
      flowerLotus: '/assets/objects/flowerLotus.glb',
      bhogPlate: '/assets/objects/bhogPlate.glb'
    }
  }
};

export function getAssetSpec(experienceId: string): AssetSpec | undefined {
  return assetManifest[experienceId];
}
