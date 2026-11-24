---
name: webxr-vr-development
description: Governs the implementation, spatial calibration, controller/hand tracking integration, and comfort guidelines for genuine WebXR Immersive VR worship in DARSHAN.
---

# WebXR VR Development Skill for DARSHAN

This skill specifies the technical implementation of genuine WebXR immersive virtual reality experiences in DARSHAN, ensuring the devotee feels physically present inside the sanctum sanctorum.

## 1. WebXR Core Principles

1. **One Unified World, Zero Duplication:**
   - VR mode must utilize the exact same 3D temple scene, PBR materials, Shiva Lingam, sacred offerings, audio, and water simulation as Normal Screen mode.
   - Never create a "fake VR" split-screen canvas or duplicate scene hierarchy.

2. **Real-World Metric Spatial Scale:**
   - 1 Three.js unit = 1 real-world meter ($1.0\text{ m}$).
   - Devotee eye height: $1.60\text{ m}$ to $1.72\text{ m}$ above the stone floor.
   - Altar table height: $y = 0.76\text{ m}$ to $0.85\text{ m}$ above floor ($y = 0.0\text{ m}$ relative to altar top).
   - Kalash height: $0.15\text{ m}$ ($15\text{ cm}$), Lingam dome height: $0.38\text{ m}$ ($38\text{ cm}$).

3. **Session Lifecycle & Capability Detection:**
   ```ts
   if ('xr' in navigator) {
     const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
     // Enable WebXR button only when true
   }
   ```
   - Request session with `requiredFeatures: ['local-floor']` and `optionalFeatures: ['hand-tracking', 'bounded-floor']`.
   - Bind renderer: `renderer.xr.enabled = true`.

4. **Controller & Hand Tracking Input:**
   - Support standard 6-DoF XR controllers (`squeeze` to grab vessels/offerings, trigger/analog tilt to pour).
   - Support native WebXR Hand Tracking (`XRHand`) where available for natural finger grabbing and tilting without physical controllers.

5. **Spatial Audio:**
   - Use Three.js `PositionalAudio` for temple bells, flowing water, and burning diya crackles positioned at their physical coordinates.

---

## 2. VR Comfort & Verification Checklist

- [ ] Does WebXR session launch into `immersive-vr` mode on compatible headsets (Meta Quest, Apple Vision Pro with WebXR, HTC Vive)?
- [ ] Is camera positioned comfortably at devotee eye height looking slightly downward toward the deity?
- [ ] Are ritual objects within natural arm reach ($0.45\text{ m} - 0.70\text{ m}$ from devotee)?
- [ ] Can the user grab the Water Kalash with the controller grip button and tilt it naturally to pour?
- [ ] Does exit session cleanly return the user to standard browser viewport without WebGL crashes?
