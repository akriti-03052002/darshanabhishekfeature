---
name: visual-realism
description: Guides the creation and evaluation of genuinely photorealistic devotional environments in DARSHAN, focusing on authentic Indian temple architecture (Garbhagriha), sacred black river stone (Krishna Shila) Shiva Lingam, antique hand-hammered metals, organic botanical offerings, and warm chiaroscuro temple lighting.
---

# Visual Realism Skill for DARSHAN

This skill defines the technical workflows, material formulations, architectural principles, and visual benchmarks required to create genuine photorealism in DARSHAN's 3D sacred worship environments.

## 1. Core Visual Principles for Sacred Indian Sanctuaries

1. **Sacred Chiaroscuro Over Flat Illumination:**
   - Real Hindu temple sanctums (*Garbhagriha*) are intimate, spiritually focused spaces lit primarily by brass oil lamps (*diyas*, *samais*), camphor flames, and a subtle focused beam illuminating the deity.
   - **Anti-Pattern:** Never flood the scene with high-intensity ambient or hemisphere light (`intensity > 0.65`). Never use cold white light (`> 5500K`). Avoid pitch-black horror voids or flat orange cartoon filters.
   - **Target Formula:** Soft warm ambient bounce (`0.35 - 0.45` intensity, warm beige `#ffe0b8` to dark umber `#4a3422`), accompanied by an overhead divine spotlight (`#fffaee`, intensity `2.2 - 2.8`, penumbra `0.65 - 0.75`) focused strictly on the deity and altar offerings.

2. **Aged Stone Architecture (*Ashlar Masonry*):**
   - Temple walls and pillars must represent dressed, weathered Indian temple granite or sandstone (Khajuraho, Hampi, Kashi Vishwanath, Chidambaram).
   - Surfaces must possess distinct horizontal block courses, staggered vertical mortar joints, chiseled relief, and micro-mineral pitting.
   - Normal and bump mapping (`sandstoneBump`) with an appropriate scale (`bumpScale: 0.007 - 0.009`) must catch the grazing light of flanking temple braziers.

3. **Sacred Consecrated Deity Stone (*Krishna Shila / Narmadeshwar Basalt*):**
   - The Shiva Lingam must visually resemble consecrated black river stone—smooth, dense, velvety, and hand-rubbed with years of sacred oils, milk, and water.
   - **Anti-Pattern:** Never use high metalness (`metalness > 0.05`), high chrome mirrors, or plastic glass coatings (`transmission > 0.0` for stone).
   - **Target Formula:** `color: 0x242327`, `roughness: 0.46 - 0.50`, `metalness: 0.02 - 0.04`, `envMapIntensity: 0.70 - 0.85`, with micro-grain bump mapping (`bumpScale: 0.002`).

4. **Sacred Forehead Adornment (*Vibhuti Tripundra & Kumkum Bindu*):**
   - The three horizontal Tripundra stripes must be rendered with 3D proud curvature (`TubeGeometry` or elevated mesh bands, offset by `+3mm` from stone radius) in matte chalky sacred ash white (`#ffffff`, `roughness: 0.95`).
   - A bright vermilion Kumkum red bindu (`#d91616`, `roughness: 0.55`) and golden Chandan sandalwood dot (`#facc15`) must be clearly centered on the front face.

5. **Antique Hammered Metalwork:**
   - Sacred vessels (Kalash, Lota, Aarti Thali, Jalpatra) must represent authentic Indian hand-hammered metals:
     - **Antique Brass:** Deep warm gold (`#dca842` to `#c89944`), `roughness: 0.28 - 0.32`, `metalness: 0.82 - 0.86`, hand-beaten dimple bump map (`bumpScale: 0.0026`).
     - **Sacred Red Copper:** Rich reddish copper (`#c45e38` to `#b85836`), `roughness: 0.30 - 0.34`, `metalness: 0.80 - 0.84`, hand-hammered texture.

6. **Botanical Freshness & Organic Volumes:**
   - **Marigold Garland (*Genda Mala*):** Must be a voluminous double-layered garland with deep saffron-orange marigolds (`#ea580c`), golden marigolds (`#f59e0b`), and white Mogra jasmine (`#ffffff`), with a 5-blossom pendant cluster cascading proudly over the stone Yoni spout lip.
   - **Bilva Patra:** 3 trifoliate green leaves (`#22c55e`) with central sandalwood Chandan dot resting securely on the crown curve of the Lingam.
   - **Fruit Bhog:** Cracked half coconut showing fibrous outer coir husk and crisp white inner meat, ripe yellow bananas with green-brown tips, and fresh pomegranate.

---

## 2. Realism Verification Checklist

Before approving any visual asset or scene update:
- [ ] Is the temple environment clearly readable without being washed out or plunged into black darkness?
- [ ] Do stone walls and pillars display visible ashlar blocks, mortar grooves, and carved architectural details?
- [ ] Does the Shiva Lingam resemble consecrated black stone rather than a metallic cylinder or flat plastic?
- [ ] Are the Tripundra stripes, red Kumkum bindu, and Chandan dot crisp, bold, and fully visible on the front face?
- [ ] Does the flower garland hug the base with organic volume, with blossoms cascading over the front Yoni lip?
- [ ] Do metal vessels display hand-hammered artisan relief and authentic brass/copper color values?
- [ ] Is the altar surface an authentic stone slab platform rather than an artificial modern desk runner?
