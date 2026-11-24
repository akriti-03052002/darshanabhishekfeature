---
name: project-understanding
description: Captures the architectural blueprint, state management patterns, component responsibilities, asset pipelines, and core purpose of DARSHAN — First-Person Virtual Pooja & Seva.
---

# Project Understanding Skill for DARSHAN

This skill provides an architectural overview of DARSHAN, its component structure, data flows, and design principles.

## 1. Application Purpose & Devotional Context

DARSHAN is a first-person virtual worship (*Pooja & Seva*) application enabling devotees worldwide to perform authentic, interactive religious rituals in photorealistic sacred spaces. Devotees interact using touch, mouse, webcam hand-tracking, or WebXR virtual reality.

## 2. Directory Structure & Key Files

```text
src/
├── assets/images/              # Bundled photographic macro textures & deity cards
├── audio/                      # Vedic chants, bells, conch shells, and ambient audio
├── components/
│   ├── ExperienceGrid.tsx      # Multi-faith selection grid for all 9 spiritual traditions
│   ├── GestureIcon.tsx         # Hand gesture UI indicators
│   ├── ModeModal.tsx           # Interaction mode selection (Touch/Mouse, Camera, WebXR)
│   ├── RitualViewport.tsx      # Main 3D ritual canvas, HUD, bottom dock, audio controls
│   └── VirtualHandController.tsx # MediaPipe camera hand tracking & 3D hand visualization
├── data/
│   ├── assetManifest.ts        # Texture & audio asset registry
│   ├── experiences.ts          # Step definitions, liturgical texts, and prop coordinates
│   └── traditionVisualConfig.ts # Color palettes, lighting configs per tradition
├── logic/
│   ├── collisionPhysics.ts     # AABB, raycast, and surface collision detection
│   ├── gestureEngine.ts        # Hand landmark smoothing, pinch/grab detection, debouncing
│   ├── physicsEngine.ts        # Liquid volume depletion and trajectory math
│   └── ritualEngine.ts         # Step completion state machine and ritual progression
└── three/
    ├── proceduralTextures.ts   # Canvas PBR texture synthesis (basalt, sandstone, brass)
    ├── ritualModels.ts         # 3D geometry builders for sanctum, Lingam, and offerings
    ├── RitualSceneManager.ts   # Core Three.js renderer, lighting, camera, and render loop
    └── virtualHands.ts         # Procedural 3D hand rigged mesh
```

---

## 3. Data & State Flow

1. **Ritual State Machine (`src/logic/ritualEngine.ts`):**
   - Tracks current step index, completed steps, active held object, pouring state, remaining liquid percentage, and completed ritual callbacks.
2. **Synchronized Rendering (`src/components/RitualViewport.tsx`):**
   - Bridges React state to Three.js `RitualSceneManager`.
   - Propagates user input (mouse drag, touch gestures, or camera landmarks) to 3D object transformations in real time.
3. **Preservation Principle:**
   - Extend existing modules cleanly; never rewrite core logic or break existing tradition definitions.
