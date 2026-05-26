# Admin → CMS → Branding → Main Banner (Page Design)

## Layout

* Desktop-first two-column layout: **Editor (left, \~480–560px)** + **Preview (right, fluid)**.

* Use CSS Grid: `grid-template-columns: 520px 1fr; gap: 24px;`.

* Tablet (<1024px): switch to stacked layout with Preview collapsible to a drawer/accordion.

## Meta Information

* Title: “Branding – Main Banner | Admin CMS”

* Description: “Configure responsive storefront hero banner with preview and publish.”

* Open Graph: `og:title`, `og:description`, `og:type=website` (internal), `robots=noindex`.

## Global Styles

* Background: `#0b1220` (admin shell) with content surface `#0f172a` / `#111827`.

* Typography: 14–16px base; headings 18/20/24.

* Form controls: 40px height, 8px radius, clear error states.

* Primary button: solid, high contrast; hover darken; disabled state visibly muted.

## Page Structure

1. Admin header (breadcrumb + actions)
2. Main content grid (Editor column + Preview panel)

## Sections & Components

### 1) Header / Action Bar

* Breadcrumb: “Admin / CMS / Branding / Main Banner”.

* Tenant indicator (read-only): resolved server-side.

* Right actions:

  * “Revert to last published” (secondary, destructive confirmation)

  * “Publish” (primary, opens modal)

  * Draft status chip: “Saved just now / Unsaved changes / Saving…”

### 2) Editor Column (Form)

Organize as stacked cards.

**2.1 Banner Image Card**

* Upload dropzone + button.

* Helper text: accepted formats + max size.

* Thumbnail preview with file info (dimensions, format).

* Actions: Replace, Remove.

* Error UI: inline message under control.

**2.2 Responsive Height Card**

* 3 numeric inputs with labels:

  * Mobile (<768)

  * Tablet (768–1279)

  * Desktop (≥1280)

* Range hints: 100–1200px.

* Inline validation: red border + message; prevent publish if invalid.

**2.3 Focal Point / Object Position Card**

* Preset segmented control: Top / Center / Bottom / Left / Right.

* “Custom” reveals text input for raw CSS `object-position`.

* Optional focal point picker:

  * Clickable image thumbnail; stores normalized `"x% y%"`.

  * Show crosshair indicator.

**2.4 Overlay Card (Optional)**

* Toggle: Enable overlay.

* When enabled:

  * Position select: Left/Center/Right.

  * Headline (required) + subheadline.

  * CTA label + CTA URL (URL required if label set).

  * Background style select + opacity slider (0–100).

  * Text color picker.

### 3) Preview Panel

* Panel header: “Preview” + viewport switcher.

* Viewport switcher (segmented control): Mobile 375 / Tablet 768 / Desktop 1280.

* Preview canvas:

  * Fixed width matching selection; centered; scroll independent.

  * Renders banner with `object-fit: cover; width: 100%; height: [breakpoint height]px`.

  * Shows an “Unpublished changes” banner.

### 4) Publish Modal

* Title: “Publish banner changes?”

* Body: short diff summary (changed fields list).

* Buttons: Cancel / Publish.

* On success: toast “Published”, status chip updates.

## Interaction & State

* Autosave draft on change with 300ms debounce; text fields save on blur.

* Loading states: skeleton for preview + disabled publish until draft loaded.

* Error handling: blocking banner for load/publish errors; keep local draft in form state.

* Accessibility: labels for all inputs; keyboard-operable viewport switcher; focus-visible rings.

