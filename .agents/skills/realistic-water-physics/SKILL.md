---
name: realistic-water-physics
description: Governs the implementation, calibration, and verification of dynamic Abhishek water and milk liquid physics in DARSHAN, including finite vessel capacity, tilt-driven flow rate, parabolic stream generation, surface collision, wetness accumulation, runoff rivulets, and drainage.
---

# Realistic Water Physics Skill for DARSHAN

This skill documents the interactive liquid simulation and surface wetness pipeline for holy Abhishek rituals (water Gangajal, milk, panchamrita).

## 1. Physical Model Principles

1. **Finite Liquid Capacity:**
   - Vessels (Kalash / Lota) must hold a finite sacred volume ($100\%$ initial capacity).
   - Liquid level inside the vessel (`liquidSurface`) must drop proportionally as liquid pours out.
   - When volume reaches $0\%$, liquid flow must naturally taper off and cease.

2. **Tilt-Driven Discharge (Torricelli / Weir Model):**
   - No pouring occurs until vessel tilt exceeds the spout lip angle ($\theta > 32^\circ$).
   - Flow rate scales smoothly with tilt angle ($\theta = 35^\circ \to 85^\circ$ yields $15\% \to 100\%$ discharge velocity).
   - Flow origin must align with the physical rim/spout tip (`spoutTip` coordinate), never the center of the vessel mesh.

3. **Parabolic Stream Geometry:**
   - The pouring stream is synthesized via dynamic vertex updating along a parabolic ballistic trajectory:
     $$\vec{P}(t) = \vec{P}_0 + \vec{V}_0 t + \frac{1}{2} \vec{g} t^2$$
   - Stream radius expands and contracts based on instantaneous flow rate and gravitational acceleration.
   - Material switches between crystalline holy Gangajal (`ior: 1.333`, `transmission: 0.94`, `roughness: 0.015`) and opaque milk (`#fdfaf5`, `roughness: 0.34`).

4. **Surface Collision & Wetness Darkening:**
   - When the stream trajectory intersects the deity collision volume (Lingam dome at $y = 0.493$), splash particles emit outward at contact points.
   - Wetness parameter accumulates dynamically on the stone surface:
     - Dry Krishna Shila: `color: 0x242327`, `roughness: 0.48`.
     - Wet Krishna Shila: dynamically darkens to `0x08080a`, with `roughness` dropping to `0.08 - 0.12` and specular reflections increasing.
   - Runoff streams flow downward along the cylinder into the circular *snana-droni* (Yoni basin) and drain through the *Gomukha* spout into the copper catchment basin.

---

## 2. Testing & Calibration Checklist

- [ ] Does liquid remain inside the vessel when upright ($\theta < 30^\circ$)?
- [ ] Does liquid stream originate from the actual spout lip when tilted?
- [ ] Does the stream arc naturally toward the Lingam dome based on tilt?
- [ ] Does remaining volume decrease steadily during pouring?
- [ ] Does stone darken and glisten with wet reflections upon liquid contact?
- [ ] Does runoff drain from the Gomukha spout into the copper Jalpatra bowl?
- [ ] Does the stream stop cleanly when liquid volume reaches $0\%$ or vessel is uprighted?
