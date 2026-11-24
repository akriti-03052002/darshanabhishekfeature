---
name: threejs-3d-development
description: Guides Three.js scene architecture, PBR material formulation, procedural texture synthesis, lighting setups, geometry construction, and performance optimization within the DARSHAN codebase.
---

# Three.js 3D Development Skill for DARSHAN

This skill documents the technical architecture, Three.js coding conventions, PBR workflows, asset loading strategies, and memory management rules required across DARSHAN.

## 1. Key Three.js Architecture in DARSHAN

1. **`src/three/RitualSceneManager.ts`:**
   - The central orchestrator managing the `THREE.WebGLRenderer`, `THREE.PerspectiveCamera`, `THREE.Scene`, `THREE.StereoCamera` (for WebXR/stereo viewports), and interaction raycasting.
   - Responsible for lifecycle events (`init`, `renderLoop`, `resize`, `dispose`), lighting hierarchy, and dynamic state bindings.
   - **Performance Flag:** Inspects `this.isSoftwareGl` to intelligently throttle shadow maps and expensive post-processing on constrained devices.

2. **`src/three/proceduralTextures.ts`:**
   - Procedural canvas-based texture synthesis pipeline returning a `TextureBundle`.
   - Generates high-anisotropy PBR maps (Albedo, Bump, Roughness, Normal) for basalt stone, marble, carved teakwood, ashlar sandstone, hammered brass, khadi textiles, and botanical cutouts.
   - Uses `upgradeWithImage()` to load photographic macro textures asynchronously while maintaining fallback canvas generation for zero startup latency.

3. **`src/three/ritualModels.ts`:**
   - Procedural and composite geometric model generation for all 9 religious traditions (Hindu, Buddhist, Sikh, Christian, Islamic, Jain).
   - Functions `buildSanctumEnvironment()`, `buildShivaAltar()`, `buildInteractiveProp()`, and `buildExperienceScene()` create the complete sacred stage.

---

## 2. PBR Material Standards & Best Practices

| Material Type | Color / Map | Roughness | Metalness | Bump / Normal Map | EnvMap Intensity | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Krishna Shila Stone** | `0x242327`, `basaltMap` | `0.48` | `0.02` | `basaltBump` (`0.0022`) | `0.75` | Velvety river stone satin sheen; zero transmission |
| **Aged Temple Sandstone** | `0xbfa993`, `sandstoneMap` | `0.72` | `0.02` | `sandstoneBump` (`0.008`) | `0.40` | Chiselled ashlar block relief; prominent mortar joints |
| **Hammered Antique Brass** | `0xdca842` | `0.30` | `0.82` | `brassRoughness` (`0.0026`)| `1.25` | Hand-beaten indents catch warm specular highlights |
| **Sacred Red Copper** | `0xc45e38` | `0.32` | `0.82` | `brassRoughness` (`0.0028`)| `1.15` | Antique reddish copper vessel body |
| **Sacred Water Stream** | `0xffffff`, transparent | `0.015` | `0.00` | None | `1.80` | `transmission: 0.94`, `ior: 1.333`, `clearcoat: 1.0` |
| **Fresh Milk Abhishek** | `0xfdfaf5` | `0.34` | `0.00` | None | `0.35` | Opaque rich cow's milk with soft subsurface scattering |

---

## 3. Geometry Construction & Optimization Guidelines

1. **Avoid Primitive Meshes as Final Assets:**
   - Do NOT use bare, unrefined cylinders or boxes as final architectural pillars or sacred deity idols.
   - Always build compound architectural assemblies with stepped plinths (`BoxGeometry` with bevels), transitional drums (`CylinderGeometry` with octagonal or 16-faceted segments), and carved bell capitals (`LatheGeometry`).
2. **Dynamic Curve Sweeps:**
   - Use `THREE.CatmullRomCurve3` with `THREE.TubeGeometry` for natural organic forms like serpent columns, garlands, and Tripundra forehead bands.
3. **Resource Disposal & Memory Management:**
   - Always traverse groups upon teardown and dispose geometries, materials, and canvas textures to prevent WebGL context leaks:
     ```ts
     mesh.geometry.dispose();
     if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
     else mesh.material.dispose();
     ```
