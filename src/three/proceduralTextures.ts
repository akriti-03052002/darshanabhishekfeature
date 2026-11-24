import * as THREE from 'three';

import { PHOTO_MACRO_TEXTURES } from '../data/assetManifest';

import blackBasaltUrl from '../assets/images/real_krishna_shila.jpg';
import hammeredBrassUrl from '../assets/images/real_hammered_brass.jpg';
import hammeredCopperUrl from '../assets/images/real_hammered_copper.jpg';
import marigoldFlowerUrl from '../assets/images/real_marigold_flower.jpg';
import silkVastraUrl from '../assets/images/silk_pooja_vastra_1794919880925.jpg';
import wovenCottonUrl from '../assets/images/woven_cotton_sleeve_1794919880338.jpg';
import marbleTileUrl from '../assets/images/sanctum_marble_tile_1794918170349.jpg';
import carvedTeakUrl from '../assets/images/carved_teak_wood_1794918169920.jpg';
import sandstoneWallUrl from '../assets/images/real_temple_stone.jpg';
import realShivaSanctumBgUrl from '../assets/images/real_shiva_sanctum_bg.jpg';

import shivaCardUrl from '../assets/images/shiva_abhishek_card_1794915122107.jpg';
import krishnaCardUrl from '../assets/images/krishna_makhan_card_1794915123507.jpg';
import balajiCardUrl from '../assets/images/salasar_balaji_card_1794915123986.jpg';
import durgaCardUrl from '../assets/images/maa_durga_card_1794915124368.jpg';
import buddhaCardUrl from '../assets/images/buddha_seva_card_1794915125152.jpg';
import sikhCardUrl from '../assets/images/sikh_seva_card_1794915125441.jpg';
import christianCardUrl from '../assets/images/christian_prayer_card_1794915125810.jpg';
import islamicCardUrl from '../assets/images/islamic_ziyarat_card_1794915126893.jpg';
import mahavirCardUrl from '../assets/images/mahavir_swami_card_1794915127191.jpg';

export const BUNDLED_SHRINE_IMAGES: Record<string, string> = {
  shiva: shivaCardUrl,
  krishna: krishnaCardUrl,
  balaji: balajiCardUrl,
  durga: durgaCardUrl,
  buddha: buddhaCardUrl,
  sikh: sikhCardUrl,
  christian: christianCardUrl,
  islamic: islamicCardUrl,
  mahavir: mahavirCardUrl
};

export interface TextureBundle {
  basaltMap: THREE.CanvasTexture;
  basaltBump: THREE.CanvasTexture;
  marbleMap: THREE.CanvasTexture;
  altarMarbleMap: THREE.CanvasTexture;
  marbleRoughness: THREE.CanvasTexture;
  woodMap: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  sandstoneMap: THREE.CanvasTexture;
  sandstoneBump: THREE.CanvasTexture;
  brassMap: THREE.CanvasTexture;
  brassRoughness: THREE.CanvasTexture;
  copperMap: THREE.CanvasTexture;
  copperRoughness: THREE.CanvasTexture;
  marigoldPhotoMap: THREE.CanvasTexture;
  skinMap: THREE.CanvasTexture;
  skinBump: THREE.CanvasTexture;
  sleeveMap: THREE.CanvasTexture;
  leafMap: THREE.CanvasTexture;
  leafCutoutMap: THREE.CanvasTexture;
  petalMap: THREE.CanvasTexture;
  marigoldPetalMap: THREE.CanvasTexture;
  fruitMap: THREE.CanvasTexture;
  bananaMap: THREE.CanvasTexture;
  boondiMap: THREE.CanvasTexture;
  boondiBump: THREE.CanvasTexture;
  pedaMap: THREE.CanvasTexture;
  pedaBump: THREE.CanvasTexture;
  makhanMap: THREE.CanvasTexture;
  makhanBump: THREE.CanvasTexture;
  brocadeMap: THREE.CanvasTexture;
  brocadeBump: THREE.CanvasTexture;
  flameSpriteMap: THREE.CanvasTexture;
  smokeSpriteMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  shivaSanctumBgMap: THREE.CanvasTexture;
  createTrackedImageTexture: (
    url: string,
    width?: number,
    height?: number,
    onImageReady?: (img: HTMLImageElement) => void
  ) => THREE.CanvasTexture;
  whenReady: Promise<void>;
  dispose: () => void;
}

function makeCanvas(width: number, height = width): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy = 4): TextureBundle {
  const created: THREE.Texture[] = [];
  const pendingLoads: Promise<void>[] = [];

  const finalize = (
    canvas: HTMLCanvasElement,
    isColor: boolean,
    repeatX = 2,
    repeatY = repeatX,
    clamp = false
  ): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    if (!clamp) tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    created.push(tex);
    return tex;
  };

  const upgradeWithImage = (
    tex: THREE.CanvasTexture,
    url: string,
    repeatX: number,
    repeatY: number,
    clamp = false,
    onDraw?: (img: HTMLImageElement, ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ) => {
    const p = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = tex.image.getContext('2d');
        if (ctx) {
          if (onDraw) {
            onDraw(img, ctx, tex.image.width, tex.image.height);
          } else {
            ctx.drawImage(img, 0, 0, tex.image.width, tex.image.height);
          }
          tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
          tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
          if (!clamp) tex.repeat.set(repeatX, repeatY);
          tex.anisotropy = maxAnisotropy;
          tex.needsUpdate = true;
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
    pendingLoads.push(p);
  };

  // 1. Authentic Consecrated Black River Stone (Krishna Shila / Narmadeshwar Basalt - Panel 2 Reference)
  // Velvety smooth, fine-grained, deep charcoal stone with subtle organic mineral warmth
  const [basaltC, bCtx] = makeCanvas(512);
  bCtx.fillStyle = '#1e1d21';
  bCtx.fillRect(0, 0, 512, 512);
  // Soft organic river stone tonal undulations
  for (let i = 0; i < 40; i++) {
    const rx = Math.random() * 512;
    const ry = Math.random() * 512;
    const rad = 60 + Math.random() * 120;
    const grad = bCtx.createRadialGradient(rx, ry, 5, rx, ry, rad);
    const v = 32 + Math.floor(Math.random() * 18);
    grad.addColorStop(0, `rgba(${v}, ${v - 1}, ${v + 2}, 0.35)`);
    grad.addColorStop(1, 'rgba(30, 29, 33, 0)');
    bCtx.fillStyle = grad;
    bCtx.beginPath();
    bCtx.arc(rx, ry, rad, 0, Math.PI * 2);
    bCtx.fill();
  }
  // Micro-fine satin stone grain & minerals
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 28 + Math.floor(Math.random() * 20);
    bCtx.fillStyle = `rgb(${v},${v},${v + 1})`;
    bCtx.fillRect(x, y, 1, 1);
  }
  const basaltMap = finalize(basaltC, true, 1, 1);

  const [bumpC, bumpCtx] = makeCanvas(512);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 118 + Math.floor(Math.random() * 22);
    bumpCtx.fillStyle = `rgb(${g},${g},${g})`;
    bumpCtx.fillRect(x, y, 1, 1);
  }
  const basaltBump = finalize(bumpC, false, 1, 1);

  upgradeWithImage(basaltMap, blackBasaltUrl, 1, 1, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    // Real Consecrated Krishna Shila River Stone (Panel 2 & 5 Reference)
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const bData = bumpCtx.createImageData(w, h);
    const bd = bData.data;
    for (let i = 0; i < d.length; i += 4) {
      const origLum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Generate authentic high-frequency bump map from the real stone's micro-pitting
      const bumpVal = Math.round(112 + (origLum / 255) * 36);
      bd[i] = bumpVal;
      bd[i + 1] = bumpVal;
      bd[i + 2] = bumpVal;
      bd[i + 3] = 255;
    }
    bumpCtx.putImageData(bData, 0, 0);
    basaltMap.needsUpdate = true;
    basaltBump.needsUpdate = true;
  });

  // 2. Sanctum Makrana Marble Floor + Dedicated High-Res Makrana Altar Slab
  const [marbleC, mCtx] = makeCanvas(512);
  mCtx.fillStyle = '#e8dfd1';
  mCtx.fillRect(0, 0, 512, 512);
  const marbleMap = finalize(marbleC, true, 5, 5);
  upgradeWithImage(marbleMap, marbleTileUrl, 5, 5);

  const [altarMC, amCtx] = makeCanvas(1024);
  amCtx.fillStyle = '#eae1d3';
  amCtx.fillRect(0, 0, 1024, 1024);
  const altarMarbleMap = finalize(altarMC, true, 2, 1);

  const [marbleRC, mrRCtx] = makeCanvas(512);
  mrRCtx.fillStyle = '#525252';
  mrRCtx.fillRect(0, 0, 512, 512);
  const marbleRoughness = finalize(marbleRC, false, 2, 1);

  upgradeWithImage(altarMarbleMap, PHOTO_MACRO_TEXTURES.marbleAltarUrl, 2, 1, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    mrRCtx.drawImage(img, 0, 0, 512, 512);
    const frame = mrRCtx.getImageData(0, 0, 512, 512);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      // Honed marble veins are slightly more matte, polished cream body is glossier
      const r = Math.min(185, Math.max(48, Math.round(135 - (lum / 255) * 72)));
      d[i] = r;
      d[i + 1] = r;
      d[i + 2] = r;
    }
    mrRCtx.putImageData(frame, 0, 0);
    marbleRoughness.needsUpdate = true;
  });

  // 3. Carved Indian Teakwood (512px AI seamless teak + luminance wood-grain bump)
  const [woodC, wCtx] = makeCanvas(512);
  wCtx.fillStyle = '#4a2e1b';
  wCtx.fillRect(0, 0, 512, 512);
  const woodMap = finalize(woodC, true, 2, 2);

  const [woodBC, wbCtx] = makeCanvas(512);
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 512, 512);
  const woodBump = finalize(woodBC, false, 2, 2);

  upgradeWithImage(woodMap, carvedTeakUrl, 2, 2, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h).data;
    const out = wbCtx.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4) {
      const lum = Math.min(255, Math.max(0, Math.round(64 + (0.35 * src[i] + 0.5 * src[i + 1] + 0.15 * src[i + 2]) * 0.9)));
      out.data[i] = lum;
      out.data[i + 1] = lum;
      out.data[i + 2] = lum;
      out.data[i + 3] = 255;
    }
    wbCtx.putImageData(out, 0, 0);
    woodBump.needsUpdate = true;
  });

  // 4. Ancient Dressed Temple Stone / Garbhagriha Ashlar Granite
  // Authentic Indian temple architectural sandstone with horizontal ashlar block courses & chiseled relief (Panel 1 Reference)
  const [sandC, snCtx] = makeCanvas(512);
  const [sandBC, snBCtx] = makeCanvas(512);

  const drawAshlarMasonry = (
    cCtx: CanvasRenderingContext2D,
    bCtx: CanvasRenderingContext2D,
    w = 512,
    h = 512
  ) => {
    // Fill base stone tone & neutral bump (Aged Indian Temple Granite / Sandstone - Panel 1)
    // Authentic neutral-warm weathered temple stone (grey-taupe with subtle warmth, avoiding orange wash)
    cCtx.fillStyle = '#7a7062';
    cCtx.fillRect(0, 0, w, h);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, w, h);

    const blockRows = 3;
    const rowH = h / blockRows;
    for (let r = 0; r < blockRows; r++) {
      const y0 = r * rowH;
      const numCols = 2;
      const colW = w / numCols;
      const offset = (r % 2) * (colW * 0.5);

      for (let c = -1; c <= numCols; c++) {
        const x0 = c * colW + offset;
        // Individual block tone variation (Panel 1 chiselled stone)
        const bVar = Math.floor((Math.random() - 0.5) * 16);
        const bTone = Math.min(135, Math.max(90, 110 + bVar));
        cCtx.fillStyle = `rgb(${bTone + 2}, ${bTone}, ${bTone - 4})`;
        cCtx.fillRect(x0 + 1.5, y0 + 1.5, colW - 3, rowH - 3);

        // Bump: block face slightly convex/pillow-faced
        const bHeight = 126 + Math.floor((Math.random() - 0.5) * 10);
        bCtx.fillStyle = `rgb(${bHeight}, ${bHeight}, ${bHeight})`;
        bCtx.fillRect(x0 + 2, y0 + 2, colW - 4, rowH - 4);

        // Soft chiseled chamfer edges of stone block
        bCtx.fillStyle = 'rgba(60, 60, 60, 0.35)';
        bCtx.strokeRect(x0 + 1.5, y0 + 1.5, colW - 3, rowH - 3);
      }

      // Horizontal subtle mortar joint
      cCtx.fillStyle = '#484034';
      cCtx.fillRect(0, y0 - 0.8, w, 1.6);
      bCtx.fillStyle = '#404040';
      bCtx.fillRect(0, y0 - 1.0, w, 2.0);
    }

    // Vertical mortar joints
    for (let r = 0; r < blockRows; r++) {
      const y0 = r * rowH;
      const numCols = 2;
      const colW = w / numCols;
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= numCols; c++) {
        const x0 = c * colW + offset;
        cCtx.fillStyle = '#484034';
        cCtx.fillRect(x0 - 0.8, y0, 1.6, rowH);
        bCtx.fillStyle = '#404040';
        bCtx.fillRect(x0 - 1.0, y0, 2.0, rowH);
      }
    }

    // Chiseled surface relief & micro-mineral pitting
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const g = 100 + Math.floor(Math.random() * 40);
      cCtx.fillStyle = `rgb(${g + 2},${g},${g - 3})`;
      cCtx.fillRect(x, y, 1.5, 1.5);

      const bg = 118 + Math.floor(Math.random() * 24);
      bCtx.fillStyle = `rgb(${bg},${bg},${bg})`;
      bCtx.fillRect(x, y, 1.5, 1.5);
    }
  };

  drawAshlarMasonry(snCtx, snBCtx);
  const sandstoneMap = finalize(sandC, true, 1, 1);
  const sandstoneBump = finalize(sandBC, false, 1, 1);

  upgradeWithImage(sandstoneMap, sandstoneWallUrl, 1, 1, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    // Real Ancient Indian Temple Stone (Garbhagriha Ashlar Granite & Sandstone - Panel 1 Reference)
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const bData = snBCtx.createImageData(w, h);
    const bd = bData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Generate authentic chiseled block relief & mortar groove depth
      const bumpVal = Math.round(95 + (lum / 255) * 65);
      bd[i] = bumpVal;
      bd[i + 1] = bumpVal;
      bd[i + 2] = bumpVal;
      bd[i + 3] = 255;
    }
    snBCtx.putImageData(bData, 0, 0);
    sandstoneMap.needsUpdate = true;
    sandstoneBump.needsUpdate = true;
  });

  // 5. Hand-Hammered Antique Brass (Panel 3 & 5 Reference)
  const [brassC, brCtx] = makeCanvas(512);
  brCtx.fillStyle = '#c89b44';
  brCtx.fillRect(0, 0, 512, 512);
  const [brassRC, brRCtx] = makeCanvas(512);
  brRCtx.fillStyle = '#525252';
  brRCtx.fillRect(0, 0, 512, 512);
  const brassMap = finalize(brassC, true, 2, 2);
  const brassRoughness = finalize(brassRC, false, 2, 2);
  upgradeWithImage(brassMap, hammeredBrassUrl, 2, 2, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h).data;
    const out = brRCtx.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.35 * src[i] + 0.52 * src[i + 1] + 0.13 * src[i + 2];
      // Hammered bright ridges gleam smoothly; recessed dimples have subtle higher patina roughness
      const rough = Math.min(170, Math.max(35, Math.round(145 - (lum / 255) * 95)));
      out.data[i] = rough;
      out.data[i + 1] = rough;
      out.data[i + 2] = rough;
      out.data[i + 3] = 255;
    }
    brRCtx.putImageData(out, 0, 0);
    brassRoughness.needsUpdate = true;
  });

  // 5b. Real Hand-Hammered Antique Red Copper (Panel 3 & 4 Reference)
  const [copperC, cpCtx] = makeCanvas(512);
  cpCtx.fillStyle = '#b55a30';
  cpCtx.fillRect(0, 0, 512, 512);
  const [copperRC, cpRCtx] = makeCanvas(512);
  cpRCtx.fillStyle = '#484848';
  cpRCtx.fillRect(0, 0, 512, 512);
  const copperMap = finalize(copperC, true, 2, 2);
  const copperRoughness = finalize(copperRC, false, 2, 2);
  upgradeWithImage(copperMap, hammeredCopperUrl, 2, 2, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h).data;
    const out = cpRCtx.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.35 * src[i] + 0.52 * src[i + 1] + 0.13 * src[i + 2];
      const rough = Math.min(175, Math.max(35, Math.round(150 - (lum / 255) * 100)));
      out.data[i] = rough;
      out.data[i + 1] = rough;
      out.data[i + 2] = rough;
      out.data[i + 3] = 255;
    }
    cpRCtx.putImageData(out, 0, 0);
    copperRoughness.needsUpdate = true;
  });

  // 5c. Real Fresh Indian Marigold & Mogra Flowers (Panel 2, 3 & 5 Reference)
  const [flowerC, flwCtx] = makeCanvas(512);
  flwCtx.fillStyle = '#ea580c';
  flwCtx.fillRect(0, 0, 512, 512);
  const marigoldPhotoMap = finalize(flowerC, true, 1, 1);
  upgradeWithImage(marigoldPhotoMap, marigoldFlowerUrl, 1, 1, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    marigoldPhotoMap.needsUpdate = true;
  });

  // 6. Photorealistic Human Skin + Handloom Khadi Sleeve Texture
  const [skinC, sCtx] = makeCanvas(512);
  const skinGrad = sCtx.createLinearGradient(0, 0, 0, 512);
  skinGrad.addColorStop(0, '#c07e59');
  skinGrad.addColorStop(0.55, '#b26f4c');
  skinGrad.addColorStop(1, '#9e5c3b');
  sCtx.fillStyle = skinGrad;
  sCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8500; i++) {
    sCtx.fillStyle =
      Math.random() > 0.45 ? 'rgba(232, 168, 132, 0.08)' : 'rgba(108, 54, 30, 0.08)';
    sCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 1.5);
  }
  sCtx.strokeStyle = 'rgba(96, 48, 28, 0.16)';
  for (let c = 0; c < 28; c++) {
    const y = 14 + c * 18 + (Math.random() - 0.5) * 4;
    sCtx.lineWidth = 0.9;
    sCtx.beginPath();
    sCtx.moveTo(0, y);
    sCtx.bezierCurveTo(170, y + (Math.random() - 0.5) * 8, 340, y + (Math.random() - 0.5) * 8, 512, y);
    sCtx.stroke();
  }
  const skinMap = finalize(skinC, true, 1);

  const [skinBumpC, sbCtx] = makeCanvas(256);
  sbCtx.fillStyle = '#808080';
  sbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3800; i++) {
    const v = 114 + Math.floor(Math.random() * 30);
    sbCtx.fillStyle = `rgb(${v},${v},${v})`;
    sbCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const skinBump = finalize(skinBumpC, false, 1);

  const [sleeveC, slCtx] = makeCanvas(512);
  slCtx.fillStyle = '#d6c8b4';
  slCtx.fillRect(0, 0, 512, 512);
  const sleeveMap = finalize(sleeveC, true, 2, 2);
  upgradeWithImage(sleeveMap, wovenCottonUrl, 2, 2);

  // 7. Botanical Leaf Venation (Bilva / Tulsi) — macro veined leaf lamina + alpha cutout
  const [leafC, lCtx] = makeCanvas(512);
  const lGrad = lCtx.createLinearGradient(0, 0, 512, 512);
  lGrad.addColorStop(0, '#276127');
  lGrad.addColorStop(0.5, '#377a33');
  lGrad.addColorStop(1, '#1f4f20');
  lCtx.fillStyle = lGrad;
  lCtx.fillRect(0, 0, 512, 512);
  const leafMap = finalize(leafC, true, 1, 1, true);

  const [leafCutC, lcCtx] = makeCanvas(512);
  lcCtx.clearRect(0, 0, 512, 512);
  lcCtx.fillStyle = '#2d6c29';
  lcCtx.beginPath();
  lcCtx.ellipse(256, 256, 150, 220, 0, 0, Math.PI * 2);
  lcCtx.fill();
  const leafCutoutMap = finalize(leafCutC, true, 1, 1, true);

  upgradeWithImage(leafMap, PHOTO_MACRO_TEXTURES.sacredLeafUrl, 1, 1, true, (img, ctx, w, h) => {
    // Crop strictly the rich interior green veined lamina (with central midrib) so zero background ever shows on ShapeGeometry
    const sx = Math.round(img.naturalWidth * 0.28);
    const sy = Math.round(img.naturalHeight * 0.22);
    const sw = Math.round(img.naturalWidth * 0.44);
    const sh = Math.round(img.naturalHeight * 0.56);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    // Populate clean alpha-masked full silhouette onto leafCutoutMap
    lcCtx.clearRect(0, 0, 512, 512);
    lcCtx.drawImage(img, 0, 0, 512, 512);
    const frame = lcCtx.getImageData(0, 0, 512, 512);
    const px = frame.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const greenDiff = g - Math.max(r, b);
      px[i + 3] = greenDiff > 16 ? 255 : greenDiff > 6 ? Math.round(((greenDiff - 6) / 10) * 255) : 0;
    }
    lcCtx.putImageData(frame, 0, 0);
    leafCutoutMap.needsUpdate = true;
  });

  // 8. Delicate Floral Petal Venation (Neutral Luminance Map + Full-Color Marigold Macro Map)
  const [petalC, pCtx] = makeCanvas(512);
  const pGrad = pCtx.createRadialGradient(256, 440, 24, 256, 208, 296);
  pGrad.addColorStop(0, '#ffffff');
  pGrad.addColorStop(0.75, '#f4efea');
  pGrad.addColorStop(1, '#dad1ca');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 512, 512);
  const petalMap = finalize(petalC, true, 1, 1, true);

  const [mariC, mrCtx] = makeCanvas(512);
  mrCtx.fillStyle = '#e58e1c';
  mrCtx.fillRect(0, 0, 512, 512);
  const marigoldPetalMap = finalize(mariC, true, 1, 1, true);

  upgradeWithImage(marigoldPetalMap, PHOTO_MACRO_TEXTURES.floralPetalsUrl, 1, 1, true, (img, ctx, w, h) => {
    const sx = Math.round(img.naturalWidth * 0.24);
    const sy = Math.round(img.naturalHeight * 0.16);
    const sw = Math.round(img.naturalWidth * 0.52);
    const sh = Math.round(img.naturalHeight * 0.56);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    // Derive crisp neutral botanical shading texture for white lilies, pink lotus & crimson hibiscus
    pCtx.drawImage(img, sx, sy, sw, sh, 0, 0, 512, 512);
    const imgData = pCtx.getImageData(0, 0, 512, 512);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.34 * d[i] + 0.56 * d[i + 1] + 0.1 * d[i + 2];
      const norm = Math.min(255, Math.max(118, Math.round(138 + (lum / 255) * 117)));
      d[i] = norm;
      d[i + 1] = norm;
      d[i + 2] = norm;
    }
    pCtx.putImageData(imgData, 0, 0);
    petalMap.needsUpdate = true;
  });

  // 9. Natural Pomegranate Skin
  const [fruitC, fCtx] = makeCanvas(256);
  const fGrad = fCtx.createLinearGradient(0, 0, 0, 256);
  fGrad.addColorStop(0, '#961726');
  fGrad.addColorStop(0.5, '#bf2d37');
  fGrad.addColorStop(1, '#d67439');
  fCtx.fillStyle = fGrad;
  fCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    fCtx.fillStyle =
      Math.random() > 0.35 ? 'rgba(255, 225, 175, 0.14)' : 'rgba(86, 12, 20, 0.18)';
    fCtx.beginPath();
    fCtx.arc(Math.random() * 256, Math.random() * 256, 0.8 + Math.random() * 1.8, 0, Math.PI * 2);
    fCtx.fill();
  }
  const fruitMap = finalize(fruitC, true, 1);

  // 10. Ripe Banana Skin
  const [banC, bnCtx] = makeCanvas(256);
  const bnGrad = bnCtx.createLinearGradient(0, 0, 256, 0);
  bnGrad.addColorStop(0, '#a3a832');
  bnGrad.addColorStop(0.18, '#ecc934');
  bnGrad.addColorStop(0.82, '#e2b922');
  bnGrad.addColorStop(1, '#6b5322');
  bnCtx.fillStyle = bnGrad;
  bnCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 240; i++) {
    bnCtx.fillStyle = 'rgba(102, 64, 24, 0.25)';
    bnCtx.beginPath();
    bnCtx.arc(Math.random() * 256, Math.random() * 256, 0.8 + Math.random() * 1.6, 0, Math.PI * 2);
    bnCtx.fill();
  }
  const bananaMap = finalize(banC, true, 1, 1, true);

  // 11. Macro Photographic Motichoor Laddoo & Mathura Saffron Peda + Luminance Bumps
  const [boondiC, bdCtx] = makeCanvas(512);
  bdCtx.fillStyle = '#d98a18';
  bdCtx.fillRect(0, 0, 512, 512);
  const [boondiB, bdbCtx] = makeCanvas(512);
  bdbCtx.fillStyle = '#808080';
  bdbCtx.fillRect(0, 0, 512, 512);
  const boondiMap = finalize(boondiC, true, 1);
  const boondiBump = finalize(boondiB, false, 1);

  const [pedaC, pdCtx] = makeCanvas(512);
  pdCtx.fillStyle = '#b47a44';
  pdCtx.fillRect(0, 0, 512, 512);
  const [pedaB, pdbCtx] = makeCanvas(512);
  pdbCtx.fillStyle = '#808080';
  pdbCtx.fillRect(0, 0, 512, 512);
  const pedaMap = finalize(pedaC, true, 1);
  const pedaBump = finalize(pedaB, false, 1);

  upgradeWithImage(boondiMap, PHOTO_MACRO_TEXTURES.edibleSweetsUrl, 1, 1, false, (img, ctx, w, h) => {
    // Right half of edible sweets image = golden glistening Motichoor Boondi Laddoo
    const lx = Math.round(img.naturalWidth * 0.54);
    const ly = Math.round(img.naturalHeight * 0.18);
    const lw = Math.round(img.naturalWidth * 0.42);
    const lh = Math.round(img.naturalHeight * 0.6);
    ctx.drawImage(img, lx, ly, lw, lh, 0, 0, w, h);

    const bImg = ctx.getImageData(0, 0, w, h);
    const bOut = bdbCtx.createImageData(w, h);
    for (let i = 0; i < bImg.data.length; i += 4) {
      const lum = Math.round(0.3 * bImg.data[i] + 0.59 * bImg.data[i + 1] + 0.11 * bImg.data[i + 2]);
      bOut.data[i] = lum;
      bOut.data[i + 1] = lum;
      bOut.data[i + 2] = lum;
      bOut.data[i + 3] = 255;
    }
    bdbCtx.putImageData(bOut, 0, 0);
    boondiBump.needsUpdate = true;

    // Left half of edible sweets image = caramelized Mathura/Saffron Peda with pistachio & saffron
    const px = Math.round(img.naturalWidth * 0.02);
    const py = Math.round(img.naturalHeight * 0.3);
    const pw = Math.round(img.naturalWidth * 0.42);
    const ph = Math.round(img.naturalHeight * 0.52);
    pdCtx.drawImage(img, px, py, pw, ph, 0, 0, 512, 512);
    const pImg = pdCtx.getImageData(0, 0, 512, 512);
    const pOut = pdbCtx.createImageData(512, 512);
    for (let i = 0; i < pImg.data.length; i += 4) {
      const lum = Math.round(0.3 * pImg.data[i] + 0.59 * pImg.data[i + 1] + 0.11 * pImg.data[i + 2]);
      pOut.data[i] = lum;
      pOut.data[i + 1] = lum;
      pOut.data[i + 2] = lum;
      pOut.data[i + 3] = 255;
    }
    pdbCtx.putImageData(pOut, 0, 0);
    pedaMap.needsUpdate = true;
    pedaBump.needsUpdate = true;
  });

  // 11b. Whipped White Cultured Makhan Butter Swirl + Micro-Churn Bump
  const [makhanC, mkCtx] = makeCanvas(256);
  const mkGrad = mkCtx.createRadialGradient(128, 128, 12, 128, 128, 140);
  mkGrad.addColorStop(0, '#fffdf7');
  mkGrad.addColorStop(0.65, '#f9f3e3');
  mkGrad.addColorStop(1, '#efe4cb');
  mkCtx.fillStyle = mkGrad;
  mkCtx.fillRect(0, 0, 256, 256);

  const [makhanBC, mkbCtx] = makeCanvas(256);
  mkbCtx.fillStyle = '#808080';
  mkbCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 42; i++) {
    const angle = i * 0.42;
    const rad = 10 + i * 2.6;
    const x = 128 + Math.cos(angle) * rad;
    const y = 128 + Math.sin(angle) * rad;
    mkCtx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.68)' : 'rgba(222,208,180,0.42)';
    mkCtx.lineWidth = 4.5;
    mkCtx.beginPath();
    mkCtx.arc(128, 128, rad, angle, angle + 1.15);
    mkCtx.stroke();

    const bv = i % 2 === 0 ? 176 : 98;
    mkbCtx.strokeStyle = `rgb(${bv},${bv},${bv})`;
    mkbCtx.lineWidth = 4;
    mkbCtx.beginPath();
    mkbCtx.arc(128, 128, rad, angle, angle + 1.15);
    mkbCtx.stroke();

    mkCtx.fillStyle = 'rgba(255,255,255,0.35)';
    mkCtx.beginPath();
    mkCtx.arc(x, y, 2.5, 0, Math.PI * 2);
    mkCtx.fill();
  }
  const makhanMap = finalize(makhanC, true, 1, 1, true);
  const makhanBump = finalize(makhanBC, false, 1, 1, true);

  // 12. Woven Silk Banarasi Pooja Vastra (512px AI seamless silk + woven zari relief bump)
  const [brocadeC, bcCtx] = makeCanvas(512);
  bcCtx.fillStyle = '#78141a';
  bcCtx.fillRect(0, 0, 512, 512);
  const [brocadeBC, bcBCtx] = makeCanvas(512);
  bcBCtx.fillStyle = '#808080';
  bcBCtx.fillRect(0, 0, 512, 512);
  const brocadeMap = finalize(brocadeC, true, 2, 1);
  const brocadeBump = finalize(brocadeBC, false, 2, 1);
  upgradeWithImage(brocadeMap, silkVastraUrl, 2, 1, false, (img, ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h).data;
    const out = bcBCtx.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4) {
      const lum = Math.min(255, Math.max(0, Math.round(70 + (0.38 * src[i] + 0.5 * src[i + 1] + 0.12 * src[i + 2]) * 0.95)));
      out.data[i] = lum;
      out.data[i + 1] = lum;
      out.data[i + 2] = lum;
      out.data[i + 3] = 255;
    }
    bcBCtx.putImageData(out, 0, 0);
    brocadeBump.needsUpdate = true;
  });

  // 13. Realistic Teardrop Flame Sprite
  const [flameC, flCtx] = makeCanvas(128);
  flCtx.clearRect(0, 0, 128, 128);
  const haloGrad = flCtx.createRadialGradient(64, 78, 4, 64, 72, 54);
  haloGrad.addColorStop(0, 'rgba(255, 255, 244, 1)');
  haloGrad.addColorStop(0.28, 'rgba(255, 200, 76, 0.92)');
  haloGrad.addColorStop(0.58, 'rgba(255, 110, 22, 0.5)');
  haloGrad.addColorStop(1, 'rgba(255, 65, 0, 0)');
  flCtx.fillStyle = haloGrad;
  flCtx.beginPath();
  flCtx.moveTo(64, 14);
  flCtx.bezierCurveTo(96, 52, 98, 104, 64, 114);
  flCtx.bezierCurveTo(30, 104, 32, 52, 64, 14);
  flCtx.fill();
  const flameSpriteMap = finalize(flameC, true, 1, 1, true);

  // 14. Soft Wispy Smoke Sprite
  const [smokeC, smCtx] = makeCanvas(128);
  const smGrad = smCtx.createRadialGradient(64, 64, 4, 64, 64, 58);
  smGrad.addColorStop(0, 'rgba(226, 224, 218, 0.34)');
  smGrad.addColorStop(0.55, 'rgba(205, 202, 196, 0.12)');
  smGrad.addColorStop(1, 'rgba(205, 202, 196, 0)');
  smCtx.fillStyle = smGrad;
  smCtx.fillRect(0, 0, 128, 128);
  const smokeSpriteMap = finalize(smokeC, true, 1, 1, true);

  // 15. Soft Contact Shadow Radial Disc
  const [shadC, shCtx] = makeCanvas(128);
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.58)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.24)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = finalize(shadC, true, 1, 1, true);

  const createTrackedImageTexture = (
    url: string,
    width = 512,
    height = width,
    onImageReady?: (img: HTMLImageElement) => void
  ): THREE.CanvasTexture => {
    const [imgC, iCtx] = makeCanvas(width, height);
    const bgGrad = iCtx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1f1812');
    bgGrad.addColorStop(0.55, '#2b2016');
    bgGrad.addColorStop(1, '#140f0b');
    iCtx.fillStyle = bgGrad;
    iCtx.fillRect(0, 0, width, height);

    const tex = finalize(imgC, true, 1, 1, true);
    const p = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = tex.image.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, tex.image.width, tex.image.height);
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAnisotropy;
          tex.needsUpdate = true;
        }
        onImageReady?.(img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
    pendingLoads.push(p);
    return tex;
  };

  const shivaSanctumBgMap = createTrackedImageTexture(realShivaSanctumBgUrl, 2048, 1152);

  // Defer Promise.all by one microtask so synchronous buildExperienceScene calls can push shrine textures
  const whenReady = Promise.race([
    Promise.resolve().then(() => Promise.all(pendingLoads).then(() => undefined)),
    new Promise<void>((resolve) => setTimeout(resolve, 4000))
  ]);

  return {
    basaltMap,
    basaltBump,
    marbleMap,
    altarMarbleMap,
    marbleRoughness,
    woodMap,
    woodBump,
    sandstoneMap,
    sandstoneBump,
    brassMap,
    brassRoughness,
    copperMap,
    copperRoughness,
    marigoldPhotoMap,
    skinMap,
    skinBump,
    sleeveMap,
    leafMap,
    leafCutoutMap,
    petalMap,
    marigoldPetalMap,
    fruitMap,
    bananaMap,
    boondiMap,
    boondiBump,
    pedaMap,
    pedaBump,
    makhanMap,
    makhanBump,
    brocadeMap,
    brocadeBump,
    flameSpriteMap,
    smokeSpriteMap,
    contactShadowMap,
    shivaSanctumBgMap,
    createTrackedImageTexture,
    whenReady,
    dispose: () => {
      created.forEach((t) => t.dispose());
    }
  };
}
