---
name: ui-ux-design
description: Guides devotional UI/UX design in DARSHAN, emphasizing minimal clutter, sacred aesthetics, bilingual support (Hindi/English), non-intrusive HUD feedback, responsive multi-device layouts, and accessibility.
---

# UI/UX Design Skill for DARSHAN

This skill defines the interface design system, interaction feedback, typography, and accessibility guidelines tailored for a sacred devotional worship application.

## 1. Devotional Design Philosophy

1. **The Deity is the Center of Devotion:**
   - The user's visual attention must remain centered on the sacred idol, sanctum architecture, and sacred offerings.
   - UI controls, status indicators, and toolbars must occupy the periphery (top bar, bottom offering dock) and never occlude the deity or altar.

2. **Sacred Color Palette & Typography:**
   - **Primary Accents:** Sacred warm saffron (`#ea580c`), golden marigold (`#f59e0b`), temple amber (`#d97706`).
   - **Background Surfaces:** Deep consecrated black (`#0f0d0b` to `#181512`), dark bronze glassmorphism (`rgba(24, 20, 16, 0.85)` with `backdrop-filter: blur(12px)`).
   - **Typography:** Elegant serif headings (*Cinzel / Playfair / Rozha One*) paired with clean legible sans-serif body (*Inter / Noto Sans Devanagari*).

3. **Bilingual Devotional Guidance:**
   - Every ritual step, prop label, and action instruction must support seamless toggling between Hindi (हिन्दी) and English.
   - Clear liturgical phrasing (e.g., *"ॐ नमः शिवाय — जल अभिषेक करें"* / *"Pour holy Gangajal over the Shiva Lingam"*).

4. **Non-Intrusive Interaction Feedback:**
   - Pouring HUD displays subtle real-time metrics (*Vessel Tilt: 50°*, *Flow Rate: 48%*, *Remaining Volume: 56%*) near the bottom dock, disappearing automatically when the vessel is returned.
   - Haptic vibration feedback on supported mobile devices when picking up or placing offerings.

---

## 2. Multi-Device Responsiveness Checklist

- [ ] Mobile Viewport: Does the bottom offering tray allow horizontal swipe without blocking the altar?
- [ ] Desktop / Tablet: Are navigation and action buttons neatly anchored in top/bottom frosted glass panels?
- [ ] Language Toggle: Does changing language instantly update HUD, step instructions, and buttons without layout shift?
- [ ] Minimal Overlays: Are all modals (Guide, Settings, Mode Selector) dismissible with one tap/click?
