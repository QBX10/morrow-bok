# Ultra-Precise UI/UX Motion & Implementation Prompt: Floating Glassmorphic Bottom Navigation Bar with Elevated Active Indicator

## 1. Objective & Core Concept
Build a floating, pill-shaped glassmorphic bottom navigation bar (`5` navigation items: Home, Favorites/Heart, Create/Plus-Circle, Profile/User, Notifications/Bell) featuring a **spring-animated elevated active circular indicator** that smoothly travels horizontally along the bar while lifting/popping upward above the main pill container when an item is selected.

---

## 2. Visual Anatomy & Design Tokens (Quantitative Specs)

### A. Container & Layout
- **Positioning:** Fixed/floating near the bottom edge of the viewport above the system home indicator bar.
- **Shape:** Full pill (`border-radius: 9999px` / capsule).
- **Horizontal Margin / Width:** Spans roughly `88%–94%` of viewport width (centered horizontally, e.g., `left: 50%; transform: translateX(-50%)` or `mx-3` to `mx-4`).
- **Height:** Approximately `56px–64px` (`3.5rem–4rem`) for the main bar body.
- **Item Distribution:** Equal-width flex/grid distribution (`5` columns, `flex: 1` each) with centered icons.

### B. Glassmorphism & Surface Styling
- **Backdrop Blur:** Frosted glass effect (`backdrop-filter: blur(18px) saturate(150%)` and `-webkit-backdrop-filter: blur(18px) saturate(150%)`).
- **Base Fill:** Translucent dark/warm-tinted glass (`rgba(28, 24, 21, 0.42)` to `rgba(36, 31, 27, 0.52)`) allowing subtle background color/contrast bleed-through.
- **Border / Rim Light:** Crisp `1px` semi-transparent border (`rgba(255, 255, 255, 0.22)` to `rgba(255, 255, 255, 0.30)`) with a subtle top/inner highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.25)`).
- **Drop Shadow:** Soft ambient elevation shadow (`0 12px 28px -6px rgba(0, 0, 0, 0.45), 0 4px 12px -2px rgba(0, 0, 0, 0.25)`).

### C. Color Palette
- **Inactive Icon Stroke:** Crisp off-white / light neutral (`rgba(245, 245, 245, 0.88)`), `strokeWidth: 1.75px–2px`, icon size `20px–22px`.
- **Active Circular Badge Fill:** Rich emerald / deep forest green (`#0F5132` to `#146C43`, or `linear-gradient(145deg, #16794C 0%, #0B3B24 100%)`).
- **Active Circular Badge Rim:** Subtle glowing green/white edge (`border: 1.5px solid rgba(74, 222, 128, 0.35)` or `rgba(255, 255, 255, 0.25)` with outer green-tinted ambient shadow `0 6px 18px rgba(16, 185, 129, 0.28)`).
- **Active Icon Stroke:** Bright mint/emerald-white (`#A7F3D0` or `#D1FAE5` / crisp light green-white) for high contrast against the deep green circle.
- **System Bottom Indicator Line (if present below bar):** Thin rounded horizontal bar (`width: ~110px–130px`, `height: 4px`, `border-radius: 9999px`, `rgba(255, 255, 255, 0.65)`).

---

## 3. Motion & Choreography Analysis (Frame-by-Frame Behavior)

### Initial State (e.g., Index `0` — Home Active)
- The emerald circular indicator (`diameter ≈ 42px–46px`) sits at index `0` and is **already elevated/protruding upward** by roughly `8px–12px` relative to the top edge of the pill bar.
- Inactive items (`1` through `4`) sit evenly spaced along the horizontal centerline of the pill bar.

### Transition / Selection State (e.g., Tapping Index `2` — Center `+` Circle Icon)
1. **Trigger:** User clicks/taps a target navigation item at index `i_target`.
2. **Horizontal Glide + Vertical Arc ("Pop-Up" Trajectory):**
   - As the active emerald circle travels horizontally from `x_current` to `x_target`, it does **not** move strictly along a flat straight line—it exhibits a **slight upward lift/arc** (`translateY` peaking around `-10px` to `-14px` from the bar center, settling cleanly at an elevated rest offset of roughly `-8px` to `-10px` above the bar's top rim).
   - **Micro-Scale Punch:** Briefly scales from `1.0` to `~1.06` during mid-flight and settles back to `1.0` on arrival (`scale: [1, 1.06, 1]`).
3. **Icon State Morph / Swap:**
   - The icon inside the moving green circle smoothly transitions (cross-fade + subtle scale `0.85 -> 1.0`) to match the newly selected destination's icon, tinted in bright mint/light-green (`#A7F3D0`).
   - The previously active icon at `x_current` returns to neutral off-white (`rgba(245, 245, 245, 0.88)`) at normal baseline alignment.
   - The newly selected icon's duplicate/base slot becomes hidden or seamlessly yields to the elevated active green badge so there is never a double icon overlapping.

---

## 4. Physics & Timing Parameters (Exact Numerical Values)

Use spring physics rather than linear or harsh ease-in-out curves:

- **Primary Indicator Spring (Position `x`, `y`, `scale`):**
  - **Framer Motion / React Spring equivalents:**
    - `type: "spring"`, `stiffness: 380`, `damping: 26`, `mass: 0.8`
    - *Equivalent CSS / Cubic-Bezier fallback (if pure CSS):* `cubic-bezier(0.22, 1.28, 0.36, 1)` over `420ms`–`480ms`.
- **Icon Cross-Fade & Micro-Scale:**
  - Duration: `180ms`–`220ms`, easing: `cubic-bezier(0.25, 0.1, 0.25, 1)` (with `opacity` and `transform: scale(...)`).
- **Tap / Press Feedback on Inactive Items:**
  - `whileTap={{ scale: 0.9 }}` with quick spring return (`stiffness: 500, damping: 30`).

---

## 5. Technical Implementation Requirements

1. **Responsive & Exact Alignment:**
   - Calculate each tab's center `x` coordinate dynamically (using `ref` measurements / `ResizeObserver` or percentage/index math inside a flex container) so the floating green indicator aligns with **sub-pixel accuracy** under every icon across mobile and desktop screen widths.
2. **Overflow & Clipping Rule:**
   - **Crucial:** The main pill bar can have `overflow: hidden` for its glass/backdrop layers *only if* the elevated green indicator is rendered in a non-clipped overlay layer above the bar (`z-index` higher than the pill surface), OR the pill container itself uses `overflow: visible` with a separate glass background layer (`position: absolute; inset: 0; border-radius: 9999px; backdrop-filter: blur(18px); overflow: hidden;`) so the green circle can rise above the top edge of the bar without getting cut off.
3. **Accessibility & Interaction:**
   - Each item must be a semantic `<button>` with `aria-current={isActive ? "page" : undefined}` and a clear `aria-label`.
   - Clicking an already-active tab should still trigger a gentle micro-bounce (`scale: [1, 1.05, 1]`) without breaking position.
4. **Integration Notes:**
   - Structure the component cleanly with props such as `items`, `activeIndex` (or `activeKey`), and `onChange(index / key)` so it can be dropped directly into the user's existing application bottom bar with minimal refactoring.

---

## 6. Verification Checklist Before Finishing
- [ ] Does the green circular indicator protrude upward above the top border of the glass pill in both initial and settled states?
- [ ] Does it glide smoothly with spring physics and a subtle lift/pop arc when switching between tabs (tested especially from left to center `+` icon and across all 5 items)?
- [ ] Are the 5 icons (Home, Heart, Plus-in-Circle, User, Bell) evenly spaced and properly aligned?
- [ ] Is the glassmorphism blur, `1px` light rim border, and deep emerald active badge clearly visible over both dark and light/warm backgrounds?