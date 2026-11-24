# 🚀 Master Prompt: "Nexus Slate" UI Architecture

## 📱 App Overview
Advanced AI-powered CRM & Agency Management Workspace. Requires a harmonious blend of the intelligent, calming Assistant (Morrow) and the high-density, structured Data/Table views.

## ⛔ Strict Non-Negotiable Rules
1. **Absolute Isolation:** Every section, setting, or sub-feature MUST open as a **Full-Screen Page** (Push Navigation). Zero Modals, Drawers, or Bottom Sheets.
2. **Core Logic Intact:** Do not alter underlying features, data structures, or assistant capabilities. Only modify "Skin" (Shapes, Colors, Typography, Shadows).
3. **Navigation:** Smooth transitions (Shared Element / Fade) between full screens.

---

## 🎨 Design Theme: "Nexus Slate" (The Hybrid Evolution)
A fusion of "Morrow's" intelligent calmness with the agency views' structural power. A high-end, tactile, and deeply focused dark-mode experience.

### 1. Geometry & Shapes (الهندسة والأشكال)
*   **Containers:** Super-ellipse (Squircle) corners (24px radius) for large cards. Subtle inner and outer shadows to create a "Soft 3D" tactile feel.
*   **Buttons:** Pill-shaped (fully rounded). Neumorphic edges (highlight on top-left, shadow on bottom-right).
*   **Typography:** Bold, high-contrast Arabic geometric sans-serif (e.g., IBM Plex Sans Arabic or Cairo). Hierarchy is driven by weight and size, not just color.

### 2. Color Palette (الألوان)
*   **Background:** Deep Slate/Charcoal (`#121212` to `#1A1A24` gradient).
*   **Primary Accent:** Amber/Gold (`#F5B041`) - derived from the app's logo, used for active states and key actions.
*   **Secondary Accent:** Electric Indigo (`#5B4FE9`) - used for AI/Assistant-related elements.
*   **Text:** Off-white (`#F0F0F5`) for primary, muted gray (`#8A8A9E`) for secondary.
*   **Data Indicators:** Emerald Green for positive, Crimson Red for negative.

### 3. Texture & Depth (الملمس والعمق)
*   **Glassmorphism Lite:** Assistant cards and top headers use a subtle, dark frosted glass effect (Background Blur: 20px, Opacity: 60%).
*   **Cards:** Flat matte finish with a 1px subtle border (border-color: rgba(255,255,255,0.08)).

---

## 🖥️ Page-by-Page Execution Guide

*   **Main Dashboard (الوكالات):** Grid layout of tactile, heavy cards. Each agency card has a clear, glowing progress bar.
*   **Assistant (Morrow):** Full-screen, ultra-minimal. Center: A glowing, pulsing 3D orb (Indigo). Prompt input at the bottom. Clean, focused, and spacious.
*   **Tables / Records (السجل الشامل):** Full-screen view. Sticky headers. Rows must feel like distinct, swipeable "slabs" rather than traditional table lines.
*   **Settings (الإعدادات):** Full-screen, minimalist list. Tapping any item pushes a new page. Icons are duotone (Gold + Gray).

## 🛠️ Engineering Notes for AI/Developer
*   Implement all state changes using full-page routing.
*   Use CSS variables for the color palette to ensure consistency.
*   Focus on micro-interactions: Buttons should depress slightly when tapped (scale: 0.98).
*   Ensure RTL (Right-to-Left) support is flawless.