# FieldShift Borderless SVG Icon System & Interactive Hover Upgrade

Integrate a complete set of clean, borderless vector SVG assets served from `/icons/*.svg` across the FieldShift interface, replacing boxed and glossy glassmorphic icon wrappers with crisp 18–24px unboxed glyphs featuring semantic color states and smooth mouse-hover reactions.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and behavioral choices were confirmed during clarification and govern this implementation:

- **Borderless SVG Assets with Mouse-Hover Reactions**: Create and serve clean, borderless SVG icon assets via `/icons/*.svg` and pair every icon with responsive mouse-hover micro-interactions (`transform` scale/tilt and color brightening within a $\le 180\text{ms}$ compositor budget).
- **Comprehensive Icon Replacement & De-Boxing**: Replace icons across all navigation rails, floating dock items, Google Earth 3D / 2D map HUD controls, climate metric headers, and action buttons—stripping away icon-specific squircle boxes, bevels, borders, glass backgrounds, and heavy glow effects.
- **Calibrated Tri-State Color Semantics**:
  - **Default / Inactive**: Muted slate-gray (`#8A99AD` in dark mode, `#5A6B5C` in light mode) for calm visual hierarchy.
  - **Active State**: High-contrast lime green (`#B7FF70` dark / `#1F6F45` light) for selected views, active stages, and primary indicators.
  - **Map-Related Actions**: Calibrated telemetry cyan (`#60CFFF` dark / `#0284C7` light) for spatial layer toggles, 3D Earth camera controls, GPS location actions, and coordinate pickers.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces legacy boxed and glossy icon containers with a unified, borderless `/icons/*.svg` asset library rendered at 18–24px, giving FieldShift a high-precision scientific telemetry appearance without visual clutter.
- **Target Audience / Persona**: Agronomists, smallholder farm advisors, and climate analysts inspecting NASA POWER agroclimatic signals and Google Earth 3D field topography.
- **Key Value**: Eliminates distracting double-borders, bevels, and ornamental icon enclosures so spatial maps, climate charts, and crop rotation scores remain the undisputed visual anchor.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Navigation & Stage Switching**: Users move between *Overview*, *My Land & 3D Earth*, *Climate Signals*, and *Rotation Planner* via the top navigation bar, stage switcher, or bottom spatial dock. Inactive icons appear in muted slate-gray, smoothly scale and brighten on mouse hover, and transition to crisp lime green when active—without surrounding squircle boxes or glass bevels.
  2. **Spatial & 3D Earth HUD Controls**: When orbiting the Google Earth 3D globe or panning the 2D Leaflet map, users interact with borderless cyan SVG glyphs for *Global Orbit*, *3D Field Tilt*, *Center Land*, *Zoom In/Out*, *Reset North*, *Fullscreen*, and *Use My GPS*. Hovering over any map control triggers a subtle scale lift and cyan luminance shift.
  3. **Telemetry Metrics & Action Affordances**: Climate summary cards (temperature, rainfall, heat stress, dry spells) and rotation cards display clean 20px borderless SVG glyphs aligned with tabular numerals, keeping focus on empirical NASA POWER values.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Precision scientific & agroclimatic telemetry console—clean unboxed iconography, crisp hairline structure, and empirical legibility.
  - *Color Palette & Mood*:
    - `--icon-inactive`: `#8A99AD` (dark) / `#5A6B5C` (light)
    - `--icon-active-lime`: `#B7FF70` (dark) / `#1F6F45` (light)
    - `--icon-map-cyan`: `#60CFFF` (dark) / `#0284C7` (light)
  - *Typography & Hierarchy*: Existing display (`Instrument Serif` / `Syne`), body (`DM Sans`), and tabular numeric (`DM Mono` with `tabular-nums`) hierarchy preserved intact.
  - *Icon Sizing & Geometry*: All SVG icons standardized between `18px` and `24px` (`18px` for inline button actions, `20px` for HUD/metric indicators, `22px–24px` for primary navigation and empty-state anchors).

- **Interactive Feedback & Motion**:
  - Hovering over an interactive control or icon triggers a smooth $\le 180\text{ms}$ `cubic-bezier(0.16, 1, 0.3, 1)` transform (`scale(1.12)` or directional nudge for arrows/compass) and transitions the icon tint from muted slate-gray to either lime green (navigation/general actions) or cyan (map/spatial actions).
  - Loading spinners (`loader.svg`) use a smooth continuous rotation animation.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: CSS Mask-Image & Semantic SVG Rendering from `/icons/*.svg`**
  - *Chosen Approach*: Serve standard, semantic SVG files from `/icons/<name>.svg` and render them via a lightweight, reusable icon component that applies CSS `mask-image: url('/icons/<name>.svg')` (with an `<img>` fallback) so each `/icons/*.svg` file is fetched directly from the public folder while dynamically inheriting exact CSS color tokens (`slate-gray`, `lime`, `cyan`) and hover transitions.
  - *Why*: Standard `<img src="/icons/...">` tags cannot dynamically animate stroke color on `:hover` or `.active` states without filter hacks, whereas CSS masking with `/icons/*.svg` loads the exact public SVG asset URL, guarantees crisp vector rendering at 18–24px, and allows instantaneous CSS color transitions on hover and active states.
  - *Alternatives Considered*: CSS `hue-rotate` filters on `<img>` tags were rejected because they produce inaccurate colors across light and dark themes.

- **Decision 2: Stripping Icon-Specific Enclosures While Preserving Button Ergonomics**
  - *Chosen Approach*: Remove all background fills, `border`, `box-shadow`, and `::before`/`::after` specular lens reflections from icon wrappers (`.liquid-glass-logo-badge`, `.metric-icon`, `.stage-pill-icon`, `.concept-card-icon`, `.earth-3d-icon-btn` inner badges) while keeping parent button hit targets $\ge 40\text{px}$ and preserving layout geometry.
  - *Why*: Directly fulfills the requirement to eliminate glossy, boxed icon clutter while maintaining accessible click areas and zero layout regressions.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Public Static SVG Assets                            │
│                        /icons/<icon-name>.svg                              │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     Borderless SvgIcon Renderer                            │
│  • Sizes: 18px (sm) | 20px (md) | 22px (lg) | 24px (xl)                    │
│  • Semantic Tones: inactive (slate) | active (lime) | map (cyan)           │
│  • Mouse-Hover Micro-Interaction: scale(1.12) + color highlight (160ms)    │
└───────────┬─────────────────────────┬──────────────────────────┬───────────┘
            │                         │                          │
            ▼                         ▼                          ▼
┌───────────────────────┐ ┌────────────────────────┐ ┌───────────────────────┐
│  Navigation & Docks   │ │ Spatial & 3D Earth HUD │ │ Telemetry & Actions   │
│  • Top Nav & Theme    │ │ • Google Earth 3D HUD  │ │ • NASA POWER Metrics  │
│  • Stage Switcher     │ │ • Layer Mode Switcher  │ │ • Crop Rotation Cards │
│  • Bottom Command     │ │ • GPS & Land Parcel    │ │ • Report Export &     │
│    Dock (No Boxes)    │ │   Pickers (Cyan Tone)  │ │   Refresh Controls    │
└───────────────────────┘ └────────────────────────┘ └───────────────────────┘
```

### Curated `/icons/*.svg` Asset Catalog

All icon graphics will be available under `/icons/` with clear, semantic filenames matching their functional role:
- **Navigation & Views**: `/icons/command.svg`, `/icons/globe-3d.svg`, `/icons/satellite.svg`, `/icons/compass.svg`, `/icons/screen.svg`, `/icons/sun.svg`, `/icons/moon.svg`
- **Spatial & Map HUD (Cyan Accent)**: `/icons/crosshair.svg`, `/icons/navigation.svg`, `/icons/map-pin.svg`, `/icons/layers.svg`, `/icons/zoom-in.svg`, `/icons/zoom-out.svg`, `/icons/maximize.svg`, `/icons/minimize.svg`
- **Agroclimatic Metrics & Signals**: `/icons/thermometer-sun.svg`, `/icons/cloud-rain.svg`, `/icons/droplets.svg`, `/icons/waves.svg`, `/icons/gauge.svg`, `/icons/sprout.svg`, `/icons/leaf.svg`, `/icons/flask.svg`, `/icons/shield-check.svg`, `/icons/trending-up.svg`
- **Actions & UI Controls**: `/icons/plus.svg`, `/icons/trash.svg`, `/icons/refresh.svg`, `/icons/download.svg`, `/icons/external-link.svg`, `/icons/settings.svg`, `/icons/check.svg`, `/icons/close.svg`, `/icons/help.svg`, `/icons/sparkles.svg`, `/icons/arrow-right.svg`, `/icons/arrow-down-right.svg`, `/icons/chevron-right.svg`, `/icons/chevron-down.svg`, `/icons/loader.svg`

### Interactive Component & State Mapping

- **Navigation Items (Top Bar, Stage Switcher, Bottom Dock)**:
  - Render borderless `/icons/*.svg` at `20px–22px`.
  - Default state uses `--icon-inactive` (`#8A99AD`); hovering the parent button or icon transitions the glyph to `--icon-active-lime` (`#B7FF70`) with a subtle `scale(1.12)` lift; active view state locks `--icon-active-lime`.
- **Map & Google Earth 3D Controls**:
  - Render borderless `/icons/*.svg` at `18px–20px` with `--icon-map-cyan` (`#60CFFF`) for spatial actions (3D Orbit, Field 3D, Center Land, GPS locate, zoom, compass reset, fullscreen, and parcel pin icons).
  - Hovering over map controls brightens the cyan glyph and applies a clean micro-scale or directional rotation without icon bevels or boxes.
- **Climate Metric Cards & Action Buttons**:
  - Strip `.metric-icon`, `.concept-card-icon`, and `.empty-icon` of their bordered square/circle backgrounds so the SVG glyphs float cleanly next to labels and values, reacting smoothly when users hover over the parent card or button.
