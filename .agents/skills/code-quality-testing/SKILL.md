---
name: code-quality-testing
description: Standardizes code quality analysis, TypeScript compilation, automated unit testing, runtime browser visual inspection, and regression testing across the DARSHAN codebase.
---

# Code Quality & Testing Skill for DARSHAN

This skill defines rigorous verification procedures to ensure that visual updates, 3D physics, and ritual logic perform flawlessly without regressions.

## 1. Multi-Tier Verification Workflow

1. **Static Analysis & Type Checking:**
   - Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors or interface mismatches.
   - Verify strict null checks, Three.js typings, and event listener signatures.

2. **Automated Unit Testing:**
   - Execute existing tests via `npm run test` (`tsx --test src/logic/*.test.ts`).
   - Validates state transitions in `ritualEngine.ts`, collision geometry math in `collisionPhysics.ts`, and gesture recognition in `gestureEngine.ts`.

3. **Runtime Browser Inspection:**
   - A successful build does NOT prove feature completion. Always launch the live application (`npm run dev`), open the browser, and inspect the rendered WebGL viewport.
   - Inspect console logs for WebGL warnings, texture loading failures, shader compile errors, or unhandled promise rejections.

4. **Interaction & Physics Testing:**
   - Test vessel selection, dragging across the 3D plane, tilt response, finite liquid depletion, surface collision, and reset.
   - Test mouse, touch, webcam hand tracking, and WebXR capability flags.

5. **Visual Comparison Against Reference Standards:**
   - Compare captured screenshots directly against target visual reference boards.
   - Examine lighting ratios, contact shadows, material roughness, specular glares, and geometry proportions.

---

## 2. Regression Testing Checklist

- [ ] Do all 9 experience modes (Shiva, Krishna, Balaji, Durga, Buddha, Sikh, Christian, Islamic, Jain) load their respective focal deities without breaking?
- [ ] Are existing application navigation, guide modal, language toggle, and audio muting functional?
- [ ] Does audio synthesize authentic temple chimes, water sounds, and mantras without overlapping distortion?
- [ ] Does the page remain responsive at 60 FPS on standard desktop and mobile hardware?
