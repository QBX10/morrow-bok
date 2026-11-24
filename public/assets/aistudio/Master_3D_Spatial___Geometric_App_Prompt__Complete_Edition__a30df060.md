# MASTER 3D SPATIAL, HOLOGRAPHIC & GEOMETRIC APPLICATION SPECIFICATION (COMPLETE EDITION)

> **SYSTEM ROLE & EXECUTION ORDER:** You are a Principal 3D UI/UX Engineer, WebGL/Three.js Shader Architect, and Spatial Motion Designer. Follow this exact execution order:
> **STEP 1 (Fixes & Refinements First):** Apply all visual, structural, and functional corrections to the existing screens and controls before building new structural layers.
> **STEP 2 (Full 3D Structural Skeleton):** Build the complete multi-layered 3D geometric skeleton across the entire application (4-layer Z-axis depth, interactive 3D shaders, 3D typography & geometric framing, and the floating 3D bottom navigation dock).
> **STEP 3 (Smart Models Interface — واجهة النماذج الذكية):** Engineer a dedicated, full-featured 3D spatial interface for Smart Models / AI Models (`واجهة النماذج الذكية`) seamlessly integrated into the same geometric and physical design system.

---

## STEP 1: MANDATORY FIXES & REFINEMENTS (تطبيق التعديلات والإصلاحات أولاً)

Before expanding the structural layout, execute every fix below with precision:

### 1.1 Symmetric Alignment of Primary Action Buttons (تقابل وتناظر الأزرار)
- **Fix:** Replace the vertically stacked, offset buttons (`"السجل الشامل للوكالات"` and `"تخصيص الواجهة"`) inside the top Hero Bento Card (`الوكالات والتوزيع`) with a **strictly symmetric 2-column horizontal row (`grid-template-columns: repeat(2, minmax(0, 1fr))`, `gap: 12px`, `width: 100%`)**.
- Both buttons must have **equal height (`52px`)**, **matching corner radii (`16px`)**, **aligned icon-to-label geometry**, and **balanced 3D bevel depth** facing each other symmetrically:
  - **Right Button:** `"السجل الشامل للوكالات"` with a crisp 3D ledger/table vector icon.
  - **Left Button:** Rename `"تخصيص الواجهة"` to **`"إدارة الواجهة الرئيسية"`** with an interactive 3D sliders/control-hub icon.

### 1.2 Home Interface Control Hub (`"إدارة الواجهة الرئيسية"` — قسم التحكم بالواجهة الرئيسية)
When tapping **`"إدارة الواجهة الرئيسية"`**, open a **3D Floating Spatial Control Modal / Sheet** (`backdrop-filter: blur(32px)`, spring entrance `stiffness: 380, damping: 28`) containing organized, interactive controls:
1. **تغيير أسماء الوكالات (Rename Agencies):** Direct inline editing for agency display names and main card headers with instant state persistence.
2. **تعديل الوكالة (Edit Agency Details):** Edit agent name, ration batch (`الوجبة الحالية`), allocated quota, and active records count.
3. **إضافة وكالة (Add Agency):** Add a new agency record directly into `"محفظة الوكالات الموحدة"` with automatic counter updates.
4. **ترتيب الواجهة (Reorder Interface Layout):** Reorder dashboard Bento cards and sections via smooth spring-animated up/down or drag handles.
5. **تخصيص الواجهة والهندسة 3D (Visual & 3D Customization):** Switch 3D color/lighting themes (`Emerald Smoked Glass`, `Holographic Cyan/Violet`, `Crimson Obsidian`), 3D tilt intensity, and card density.
6. **إضافات ذكية (Smart Utilities):** Quick sync/audit trigger, instant data export, and one-tap layout reset.

### 1.3 3D Geometric Integration of Typography, Titles, Metrics & Icons
- Do **not** render titles, descriptions, numbers, or icons as flat unstyled text on plain dark containers.
- Integrate every title (`"الوكالات والتوزيع"`, `"محفظة الوكالات الموحدة"`, `"الشاشة الرئيسية"`, etc.) and metric (`"+33 فرد"`, `"3 وكالة"`, batch dates) with:
  - **3D Layered Gradient & Specular Sheen** on headings and key numbers (`font-variant-numeric: tabular-nums`).
  - **1px Laser-Etched Geometric Dividers & Corner Brackets** framing text blocks and status badges.
  - **3D Squircle Icon Sockets** (`44px × 44px`, inner radial lighting, `1px` Fresnel top bevel, and Z-axis hover/tap lift) for all icons.

---

## STEP 2: FULL 3D GEOMETRIC SKELETON & ARCHITECTURE (تصميم الهيكل بالكامل)

Once Step 1 fixes are in place, build the full application skeleton on a **4-Layer Z-Axis Spatial Hierarchy** (`dir="rtl"`):

### 2.1 Layer 0 — Interactive 3D Geometric & Particle Background (`<Spatial3DCanvas />`)
- Full-viewport WebGL (`Three.js` / `React Three Fiber`) canvas running at `60–120fps` with `dpr={[1, 2]}`.
- Renders an **interactive 3D geometric lattice / dot-matrix topography** (`THREE.InstancedMesh` of `3,000–6,000` micro-nodes + subtle wireframe geometric rings/polyhedra) that responds smoothly to pointer movement, touch drag, scroll depth, and active screen state.
- Cleanly disposes geometries, materials, and render targets on unmount.

### 2.2 Layer 1 — Recessed Structural Channels & Geometric Framing
- Sub-panels, data slots, and secondary metric wells use **recessed inner shadows** (`box-shadow: inset 0 2px 12px rgba(0, 0, 0, 0.85), inset 0 1px 1px rgba(255, 255, 255, 0.06)`) and fine geometric grid/tick lines to establish physical depth behind elevated cards.

### 2.3 Layer 2 — Elevated 3D Glassmorphic Bento Cards (`<GlassBentoCard />`)
- Asymmetric yet balanced **Bento Grid** (`gap: 16px`, `border-radius: 24px`) across all screens.
- Multi-layered glass material:
  - `backdrop-filter: blur(28px) saturate(180%) contrast(108%);`
  - Directional `1px` specular bevel highlight (`linear-gradient(135deg, rgba(255,255,255,0.28), rgba(52,211,153,0.48), rgba(255,255,255,0.06))`).
  - Subtle 3D perspective tilt (`rotateX`, `rotateY` clamped to `±4deg`) and cursor-tracking radial light highlight.

### 2.4 Layer 3 — Floating 3D Bottom Navigation Dock (`<Floating3DDock />`)
- Detached pill dock (`height: 64px`, `border-radius: 9999px`) floating above the bottom safe area, with an unclipped foreground layer (`overflow: visible`) for the active indicator.
- **5 RTL Navigation Slots:** `[الوكالات] — [الجدول] — [إضافة] — [Morrow] — [السحب]` (plus quick access to `النماذج الذكية`).
- **Active 3D Orb & Spring Kinematics:**
  - `48px` 3D radial-lit orb protruding above the dock top edge (`translateY(-11px)` icon elevation).
  - Critically-damped spring (`stiffness: 420, damping: 30, mass: 0.85`) with velocity-coupled vertical arc (`y` lifts an extra `-5px` during fast horizontal movement).

---

## STEP 3: SMART MODELS INTERFACE (`واجهة النماذج الذكية`)

Design and integrate a dedicated, full-featured **Smart Models Interface (`واجهة النماذج الذكية`)** engineered in the exact same 3D geometric and holographic language:

### 3.1 Central 3D Holographic Core & Geometric Mesh
- At the top/center of `واجهة النماذج الذكية`, render a **3D Interactive Holographic Core / Geometric Polyhedron & Wave Matrix** (`<SmartModelCore3D />`) surrounded by orbital precision rings, Fresnel rim shaders, and real-time state reactivity (Idle standby, Thinking/Processing wave, Active Stream pulse, and Accuracy/Latency telemetry).

### 3.2 Smart Models Selector & Capability Bento Grid
- **Model Selector Cards (3D Bento Tiles):** Switch seamlessly between specialized smart models (e.g., **نموذج التدقيق والتحليل الذكي للمواد والوكالات**, **نموذج التنبؤ والجدولة الذكية**, **نموذج المعالجة السريعة للبيانات والسجلات**, **نموذج التوليد والهيكلة الذكية**), each showing live status, response latency (`ms`), context window/precision badge, and active 3D glow state.
- **Smart Prompt & Task Parameters Bar:**
  - 3D glass command input with quick task chips (تحليل الفروقات، كشف الأخطاء، تلخيص السجلات، توليد خطة عمل).
  - Precision dials/toggles styled as 3D geometric controls (مستوى الدقة والتحليل، سرعة الاستجابة، نمط الإخراج الهندسي).

### 3.3 Structured 3D Response & Reasoning Workspace
- Display model outputs inside **3D Geometric Output Cards** featuring:
  - Clear visual hierarchy with 3D headers, tabular numeric metrics, comparison tables, and geometric status indicators.
  - Interactive action controls on every response card (نسخ، تطبيق على السجل، تصدير، إعادة توليد بحركة 3D سلسة).

---

## 4. STRICT ENGINEERING & QUALITY GUARDRAILS
- **No Flat/Cartoonish Elements:** Never use flat 2D boxes, mismatched button stacks, unstyled plain text, or abrupt linear cuts.
- **Full RTL Integrity:** Every grid, modal, card, alignment, and spring trajectory must operate natively in `dir="rtl"`.
- **Smooth Performance:** Animate GPU-composited transforms (`translate3d`, `scale3d`, `rotate3d`) and `opacity` at `60–120fps`, with safe fallback/clamping on low-power devices.