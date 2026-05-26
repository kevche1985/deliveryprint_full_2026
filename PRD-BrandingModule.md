# Product Requirements Document
## Branding & Visual Identity Management — DeliveryPrint Admin Module

> **Version:** 1.0 — Draft
> **Date:** May 2026
> **Author:** Product Team
> **Status:** For Review
> **Target Release:** Q3 2026
> **Parent PRD:** PRD-DeliveryPrint MVP

---

## 1. Overview

This document defines the product requirements for the **Branding & Visual Identity Management** module within the DeliveryPrint admin portal. The module enables administrators and operators to configure all visual identity assets for the storefront — including logos, banners, color palette, typography, and UI component styles — without requiring developer intervention or a code deployment.

The module is designed around a **live WYSIWYG preview** paradigm: every change is previewed in real time across simulated viewport breakpoints (mobile, tablet, desktop) before being published. All configuration is scoped per tenant, enabling NexusCommerce's multi-tenant architecture to support independent brand identities across client storefronts.

The existing Banner upload UI (shown in the uploaded reference screenshot) is the starting point; this PRD defines the full scope of the Branding module of which banner management is one sub-section.

---

## 2. Goals & Objectives

### Primary Goal
Give admins and operators full control over storefront visual identity through a single, intuitive admin panel — replacing the need for developer involvement in any routine branding task.

### Success Metrics

- Admin can upload a new logo and publish it in under 2 minutes
- All branding changes preview accurately across all 3 breakpoints before publishing
- Zero storefront visual regressions caused by branding misconfiguration
- Full branding setup (logo + banner + palette + fonts) completable in a single session under 15 minutes
- Tenant branding config resolves server-side on every page load with ≤ 50ms overhead
- 100% of color inputs enforce WCAG AA contrast ratio validation before save

---

## 3. Target Users

| User Type | Access Level | Description |
|---|---|---|
| **Admin** | Full | Create, edit, publish, and reset all branding settings across any tenant |
| **Operator** | Scoped | Edit branding settings for their assigned tenant; cannot reset to system defaults |
| **Developer** | Read-only via API | Consumes published branding config via API/CSS variables; does not use this UI |

---

## 4. Module Structure

The Branding module is accessible from the Admin sidebar under **Settings → Branding**. It is organized into four main sections, each accessible via a tabbed or stepped navigation pattern:

1. **Logos & Favicons**
2. **Banners**
3. **Color Palette & Theme**
4. **Typography & Button Styles**

A persistent **Preview Panel** occupies the right side of the screen (or toggleable on narrow viewports), displaying a live storefront preview that updates as changes are made. A **Publish** button and **Revert to Last Published** action are always visible in the top action bar.

---

## 5. Feature Areas

---

### 5.1 Logos & Favicons

Admins can upload and configure the logo assets used throughout the storefront and admin portal.

#### 5.1.1 Logo Variants

Multiple logo variants are supported to handle different rendering contexts:

| Variant | Description | Usage Context |
|---|---|---|
| **Primary Logo** | Full color version on light background | Main header (light theme / default) |
| **Reversed Logo** | Light/white version for dark backgrounds | Header overlaid on hero images, dark navbar |
| **Compact / Icon Logo** | Square icon-only mark or monogram | Mobile header, favicon fallback, browser tab |
| **Favicon** | `.ico` or `.png` at 32×32 / 16×16 | Browser tab, bookmarks |
| **Apple Touch Icon** | PNG at 180×180 | iOS home screen shortcut |
| **Open Graph Image** | 1200×630 image | Social media link previews |

#### 5.1.2 Upload Requirements

- Accepted formats: SVG (preferred for logos), PNG with transparency, WEBP
- Maximum file size: 2 MB per asset
- SVG files are sanitized on upload to remove potential scripting
- System displays the detected dimensions and aspect ratio after upload
- Admin can set a **max display width** (in px) for the primary logo per breakpoint:

| Breakpoint | Default Max Width |
|---|---|
| Mobile (< 768px) | 120px |
| Tablet (768px – 1279px) | 160px |
| Desktop (≥ 1280px) | 200px |

- All width inputs validated as integers between 40px and 600px
- Aspect ratio is always preserved; height is derived automatically

#### 5.1.3 Logo Padding & Positioning

- Vertical padding within the header bar: configurable in px (range: 4–32px)
- Horizontal alignment: Left (default), Center
- Sticky header behavior: toggle whether logo shrinks on scroll (reduced variant activates)

#### 5.1.4 Field Reference

| Field | Type | Required | Default |
|---|---|---|---|
| Primary Logo | File upload (SVG/PNG/WEBP) | ✅ | System placeholder |
| Reversed Logo | File upload | ❌ | None |
| Compact / Icon Logo | File upload | ❌ | Auto-cropped from Primary |
| Favicon | File upload (.ico/.png) | ❌ | Icon Logo fallback |
| Apple Touch Icon | File upload (PNG) | ❌ | Icon Logo fallback |
| Open Graph Image | File upload (PNG/JPG) | ❌ | None |
| Max width — Mobile | Integer (px) | ✅ | 120 |
| Max width — Tablet | Integer (px) | ✅ | 160 |
| Max width — Desktop | Integer (px) | ✅ | 200 |
| Vertical padding | Integer (px) | ✅ | 12 |
| Horizontal alignment | Select (Left / Center) | ✅ | Left |
| Shrink on scroll | Toggle | ❌ | Off |

---

### 5.2 Banners

The Banners section manages full-width visual banners displayed on the storefront. This section expands and formalizes the existing banner upload feature (as seen in the reference screenshot), adding responsive sizing controls, image focal point, and optional overlay content.

#### 5.2.1 Banner Slots

The system supports the following configurable banner slots:

| Slot | Location | Notes |
|---|---|---|
| **Hero Banner** | Homepage — above the fold | Primary marketing banner |
| **Category Banner** | Top of product category pages | Optional; falls back to no banner |
| **Promotional Strip** | Narrow full-width band below hero | Used for announcements / coupon codes |
| **Checkout Banner** | Top of `/checkout` page | Optional trust-building image |

Each slot is configured independently.

#### 5.2.2 Image Upload & Sizing

For each banner slot, admins configure:

- **Image upload** — accepted formats: JPG, PNG, WEBP, SVG (static); max 5 MB
- **Responsive heights** — separate height (in px) per breakpoint:

| Breakpoint | Field Label | Default (Hero) |
|---|---|---|
| Mobile (< 768px) | Mobile height (px) | 320 |
| Tablet (768px – 1279px) | Tablet height (px) | 380 |
| Desktop (≥ 1280px) | Desktop height (px) | 560 |

- Height range: 100px – 1200px per breakpoint
- Width is always 100% of the viewport

#### 5.2.3 Object Position & Focal Point

- **Object Position** — CSS `object-position` value. Select from predefined options: Top, Center (default), Bottom, Left, Right, or enter a custom value (e.g., `50% 30%`)
- **Focal Point Picker** — optional visual picker: admin clicks on a thumbnail of the uploaded image to set the focal point; coordinates are converted to the CSS value automatically
- This ensures the visually important area of the image remains visible at all breakpoints

#### 5.2.4 Overlay Content (Hero Banner)

The Hero Banner slot supports optional overlay text and CTA:

| Field | Type | Required | Default |
|---|---|---|---|
| Overlay enabled | Toggle | ❌ | Off |
| Overlay position | Select (Left / Center / Right) | Conditional | Center |
| Headline text | Text (max 80 chars) | Conditional | — |
| Subheadline text | Text (max 160 chars) | ❌ | — |
| CTA button label | Text (max 30 chars) | ❌ | — |
| CTA destination URL | URL | Conditional (if label set) | — |
| Overlay background | Select (None / Dark scrim / Light scrim / Solid color) | ❌ | Dark scrim |
| Overlay background opacity | Slider (0–100%) | ❌ | 40% |
| Text color | Color picker | Conditional (if overlay on) | #FFFFFF |

#### 5.2.5 Promotional Strip Banner

The Promotional Strip is a narrow band (default 48px tall) designed for short messages. Configuration:

- Background color (color picker)
- Text content (max 120 chars)
- Text color (color picker with contrast warning)
- Optional link (URL + open in new tab toggle)
- Optional dismiss button (session-based hide)
- Integration with Coupon module: link strip text to an active coupon (auto-populates text and auto-hides on coupon expiry)

#### 5.2.6 Preview Viewport Switcher

The preview panel shows the banner rendered at the selected viewport size. Admin can switch between:

- **Mobile** — 375px wide simulated view
- **Tablet** — 768px wide simulated view
- **Desktop** — 1280px wide simulated view (default)

The current viewport selector matches the reference screenshot's "Preview Viewport" dropdown.

#### 5.2.7 Field Reference (Hero Banner)

| Field | Type | Required | Default |
|---|---|---|---|
| Banner image | File upload (JPG/PNG/WEBP/SVG) | ✅ | None |
| Mobile height (px) | Integer (100–1200) | ✅ | 320 |
| Tablet height (px) | Integer (100–1200) | ✅ | 380 |
| Desktop height (px) | Integer (100–1200) | ✅ | 560 |
| Object position | Select + custom text | ✅ | Center |
| Focal point picker | Visual click tool | ❌ | — |
| Overlay enabled | Toggle | ❌ | Off |
| Overlay position | Select | Conditional | Center |
| Headline | Text | Conditional | — |
| Subheadline | Text | ❌ | — |
| CTA label | Text | ❌ | — |
| CTA URL | URL | Conditional | — |
| Overlay BG style | Select | ❌ | Dark scrim |
| Overlay opacity | Slider 0–100% | ❌ | 40% |
| Text color | Color picker | Conditional | #FFFFFF |

---

### 5.3 Color Palette & Theme

Admins define the storefront's color system using a structured palette. Colors are stored as CSS custom properties and injected into the storefront at build time (or via a served CSS file for runtime themes).

#### 5.3.1 Core Palette Slots

| Token Name | Description | DeliveryPrint Default |
|---|---|---|
| `--color-primary` | Brand primary — buttons, links, highlights | Vermillion `#C0392B` |
| `--color-primary-hover` | Primary on hover/focus state | Auto-darkened (or manual) |
| `--color-secondary` | Secondary accent — badges, tags | Navy `#1A2E4A` |
| `--color-background` | Page background | Parchment `#FAF8F4` |
| `--color-surface` | Card/panel background | `#FFFFFF` |
| `--color-text-primary` | Main body text | Ink `#1C1C1C` |
| `--color-text-secondary` | Muted / caption text | `#6B7280` |
| `--color-border` | Default border / divider color | `#E5E0D8` |
| `--color-success` | Success states | `#16A34A` |
| `--color-warning` | Warning states | `#D97706` |
| `--color-error` | Error states | `#DC2626` |
| `--color-info` | Informational states | `#2563EB` |

#### 5.3.2 Color Input Controls

Each palette slot provides:

- **Hex input** — typed entry with live validation (`#RRGGBB` or `#RGB`)
- **Color picker** — browser-native or custom picker component
- **WCAG Contrast Checker** — real-time contrast ratio badge displayed for any foreground/background pairing:
  - ✅ AAA (≥ 7:1)
  - ✅ AA (≥ 4.5:1)
  - ⚠️ AA Large only (≥ 3:1)
  - ❌ Fails (< 3:1)
- **Auto-generate hover state** — optional toggle to auto-darken/lighten the primary color by 10% for the hover variant
- **Reset to default** — per-slot reset button restores the DeliveryPrint default token value

#### 5.3.3 Theme Presets

Admins can select from built-in theme presets as a starting point:

| Preset Name | Description |
|---|---|
| **DeliveryPrint Default** | Warm ink-and-paper, vermillion accent |
| **Midnight Navy** | Dark navy base, gold accent |
| **Clean Slate** | White/light grey, blue accent |
| **Forest & Cream** | Green primary, cream background |
| **Custom** | Any saved custom palette |

- Applying a preset populates all color slots; admin can then override individual tokens
- Admin can **save current palette as a custom preset** (name required; max 3 saved custom presets in MVP)

#### 5.3.4 Dark Mode (Phase 2)

Dark mode token overrides are out of scope for v1.0. The architecture must reserve token naming conventions to support a parallel dark-mode palette in a future version.

#### 5.3.5 Field Reference

| Field | Type | Required |
|---|---|---|
| Each palette token (12 slots) | Hex input + color picker | ✅ |
| Auto-generate hover state | Toggle | ❌ |
| WCAG contrast display | Read-only indicator | N/A |
| Theme preset selector | Select | ❌ |
| Save as custom preset | Text input + save action | ❌ |

---

### 5.4 Typography & Button Styles

Admins configure the typefaces and UI component styles that give the storefront its visual personality.

#### 5.4.1 Font Configuration

Three font roles are configurable independently:

| Font Role | CSS Variable | DeliveryPrint Default | Usage |
|---|---|---|---|
| **Display / Heading** | `--font-display` | Playfair Display | H1–H3, hero text, editorial headings |
| **Body / UI** | `--font-body` | DM Sans | Paragraphs, labels, navigation, buttons |
| **Monospace / Code** | `--font-mono` | JetBrains Mono | Order numbers, codes, invoice refs |

For each font role, admin selects from:

**Option A — Google Fonts**
- Searchable dropdown populated from Google Fonts API
- Weight selection: checkboxes for available weights (e.g., 400, 600, 700)
- Italic variant toggle
- System auto-generates the `<link>` or `@import` required

**Option B — System Font Stack**
- Predefined safe stacks: `sans-serif`, `serif`, `monospace`, `system-ui`
- No external loading; fastest performance

**Option C — Custom Font Upload** *(Phase 2)*
- Upload `.woff2` files with license acknowledgment checkbox
- Out of scope for v1.0

#### 5.4.2 Type Scale

Admins can adjust the base type scale:

| Setting | Description | Default |
|---|---|---|
| Base font size | Root `font-size` in px (affects all `rem` units) | 16px |
| Scale ratio | Modular scale multiplier | 1.25 (Major Third) |
| Line height — body | `line-height` for body text | 1.6 |
| Line height — headings | `line-height` for display text | 1.15 |

- Scale ratio options: 1.125 (Major Second), 1.25 (Major Third), 1.333 (Perfect Fourth), Custom
- Changing base size or ratio updates a **type scale preview** showing H1–H6 and body rendered live

#### 5.4.3 Button Styles

Button styles are configured for the three standard button variants:

| Variant | Usage |
|---|---|
| **Primary** | Main CTAs: "Add to Cart", "Checkout", "Save" |
| **Secondary** | Supporting actions: "View Details", "Cancel" |
| **Ghost / Outline** | Low-emphasis: "Learn More", nav items |

For each variant, admin configures:

| Property | Control | Options |
|---|---|---|
| Background color | Color picker | Any hex; uses `--color-primary` by default |
| Text color | Color picker | Any hex; WCAG contrast enforced |
| Border color | Color picker | Any hex; or "None" |
| Border width | Integer (px) | 0–4px |
| Border radius | Integer (px) | 0–32px; or toggle for "Pill" (9999px) |
| Padding (vertical) | Integer (px) | 4–24px |
| Padding (horizontal) | Integer (px) | 8–48px |
| Font weight | Select | 400 / 500 / 600 / 700 |
| Letter spacing | Number (em) | -0.05 to 0.25 |
| Text transform | Select | None / Uppercase / Capitalize |
| Hover: background | Color picker | Auto-darkened or manual |
| Hover: scale effect | Toggle | Off (default) / Slight scale (1.02) |
| Box shadow | Toggle + preset | None / Subtle / Raised / Custom |

#### 5.4.4 Form Input Styles

Basic form element styling (used in checkout, auth, filters):

| Property | Control | Default |
|---|---|---|
| Input border radius | Integer (px) | 6px |
| Input border color | Color picker | `--color-border` |
| Input border width | Integer (px) | 1px |
| Input focus ring color | Color picker | `--color-primary` |
| Input background | Color picker | `--color-surface` |
| Input font size | Integer (px) | 14px |
| Input height | Integer (px) | 40px |

#### 5.4.5 Field Reference

| Field | Type | Required |
|---|---|---|
| Display font selection (A/B/C) | Search/select | ✅ |
| Body font selection (A/B/C) | Search/select | ✅ |
| Mono font selection (A/B/C) | Search/select | ✅ |
| Font weight checkboxes (per role) | Multi-select | ✅ |
| Base font size | Integer (px) | ✅ |
| Scale ratio | Select | ✅ |
| Line heights (body, heading) | Number | ✅ |
| Button styles (Primary / Secondary / Ghost) | Per-property controls | ✅ |
| Form input styles | Per-property controls | ✅ |

---

## 6. WYSIWYG Preview Panel

The preview panel is a core feature of the Branding module — not a secondary concern. It provides an embedded, sandboxed rendering of the storefront using the current (unpublished) branding configuration.

### 6.1 Preview Scope

The preview renders a representative set of storefront elements:

- Header with logo and navigation
- Hero banner (if configured)
- Featured product card grid (using live product data from the tenant's catalog)
- A single product detail page excerpt
- Primary, secondary, and ghost buttons
- A sample form (email + text input + submit)
- Typography specimen (H1–H4, body, caption)
- Color swatches of all palette tokens
- Footer

### 6.2 Viewport Breakpoint Switcher

The preview toolbar includes a persistent breakpoint switcher:

| Button | Simulated Width | Icon |
|---|---|---|
| Mobile | 375px | Phone icon |
| Tablet | 768px | Tablet icon |
| Desktop | 1280px | Monitor icon |
| Wide | 1440px | Wide monitor (optional) |

Switching breakpoints re-renders the preview iframe at the selected width. The preview frame scrolls independently.

### 6.3 Behavior

- Preview updates **on blur** from text inputs and **on change** for color pickers, toggles, and sliders (debounced at 300ms)
- Preview uses the **unpublished draft state** — it does not reflect the live storefront until "Publish" is clicked
- A banner at the top of the preview reads: _"Preview — Unpublished changes. Publish to apply to the live storefront."_
- Admin can open the preview in a new tab (full-screen preview mode) via an icon button

---

## 7. Publish & Version Control

### 7.1 Draft vs. Published State

All branding changes are saved as a **draft** automatically (autosave every 30 seconds and on any input change). The live storefront is only updated when the admin explicitly clicks **Publish**.

| State | Description |
|---|---|
| **Draft** | Current working state; only visible in the admin preview |
| **Published** | Active configuration served to the live storefront |
| **Archived** | Previous published versions retained for rollback |

### 7.2 Publish Action

- Clicking **Publish** opens a confirmation modal summarizing the changes made since the last publish (diff summary by section)
- Confirmation required: "Publish changes to live storefront? This will affect all visitors immediately."
- On confirm: draft becomes the new published state; previous published becomes an archived version

### 7.3 Version History

- The system retains the last **10 published versions** per tenant
- Version history panel: accessible via "Version History" link in the action bar
- Each version entry shows: published timestamp, published by (admin name), a one-line summary of changed sections
- Admin can **Preview** any past version or **Restore** it (restores as a new draft for review before re-publishing)

### 7.4 Revert to Last Published

- A "Revert to Last Published" button discards all draft changes and resets the working state to the current published config
- Confirmation required: "Discard all unpublished changes? This cannot be undone."

---

## 8. Multi-Tenant Architecture Considerations

In line with NexusCommerce's core constraint that `tenant_id` is always resolved server-side:

- Branding configuration is stored in the database keyed by `tenant_id`
- The admin portal resolves the tenant context from the URL slug server-side before rendering the Branding module
- No tenant-identifying information is passed from client-side inputs to determine which config to load or save
- The published branding config is served to the storefront either:
  - **Option A:** As a generated CSS file at a deterministic URL (e.g., `/api/theme/[tenant_slug].css`) served with appropriate cache headers
  - **Option B:** As CSS custom properties injected into the `<head>` via a server component on each page render
  - Architecture decision to be finalized in Phase 0 scaffold
- Service role key is never exposed client-side; all save operations go through authenticated Next.js API routes

---

## 9. Data Models

### `tenant_branding` table

```
id                  uuid, PK
tenant_id           uuid, FK → tenants.id
state               enum ('draft', 'published', 'archived')
version_number      integer
published_at        timestamptz
published_by        uuid, FK → user_profiles.id
created_at          timestamptz
updated_at          timestamptz
config              jsonb  -- full branding config blob (see below)
```

### `config` JSON structure (summary)

```json
{
  "logos": {
    "primary": { "url": "", "maxWidthMobile": 120, "maxWidthTablet": 160, "maxWidthDesktop": 200 },
    "reversed": { "url": "" },
    "icon": { "url": "" },
    "favicon": { "url": "" }
  },
  "banners": {
    "hero": {
      "imageUrl": "",
      "heights": { "mobile": 320, "tablet": 380, "desktop": 560 },
      "objectPosition": "center",
      "overlay": { "enabled": false }
    },
    "promotionalStrip": { "enabled": false, "text": "", "bgColor": "", "textColor": "" }
  },
  "colors": {
    "primary": "#C0392B",
    "primaryHover": "#A93226",
    "secondary": "#1A2E4A",
    "background": "#FAF8F4",
    "surface": "#FFFFFF",
    "textPrimary": "#1C1C1C",
    "textSecondary": "#6B7280",
    "border": "#E5E0D8",
    "success": "#16A34A",
    "warning": "#D97706",
    "error": "#DC2626",
    "info": "#2563EB"
  },
  "typography": {
    "displayFont": { "family": "Playfair Display", "source": "google", "weights": [400, 700] },
    "bodyFont": { "family": "DM Sans", "source": "google", "weights": [400, 500, 600] },
    "monoFont": { "family": "JetBrains Mono", "source": "google", "weights": [400] },
    "baseFontSize": 16,
    "scaleRatio": 1.25,
    "lineHeightBody": 1.6,
    "lineHeightHeading": 1.15
  },
  "buttons": {
    "primary": { "bgColor": "", "textColor": "", "borderRadius": 6, "fontWeight": 600 },
    "secondary": { "bgColor": "", "textColor": "", "borderRadius": 6, "fontWeight": 500 },
    "ghost": { "bgColor": "transparent", "textColor": "", "borderWidth": 1, "borderRadius": 6 }
  },
  "inputs": {
    "borderRadius": 6, "borderColor": "", "focusColor": "", "height": 40
  }
}
```

---

## 10. Non-Functional Requirements

- All asset uploads processed and stored in Supabase Storage; CDN-served via public bucket URL
- Preview iframe must render within 500ms of a configuration change (debounced)
- Published CSS config must be served with `Cache-Control: public, max-age=300, stale-while-revalidate=60`
- On publish, CDN cache for the tenant's theme asset must be purged (Vercel edge cache invalidation)
- Branding config save operations must be atomic — partial saves must not corrupt the live config
- All color values stored and transmitted as normalized lowercase hex (`#rrggbb`)
- Font loading from Google Fonts must not block the critical rendering path (loaded with `font-display: swap`)
- Admin UI must be fully accessible (WCAG AA) and responsive on tablet and desktop viewports
- File upload validation (type, size) must occur both client-side (UX) and server-side (security)
- SVG uploads sanitized server-side to strip `<script>`, `on*` attributes, and external references
- All branding changes logged in the admin audit trail: `user_id`, `tenant_id`, `timestamp`, `section_changed`, `previous_value_hash`

---

## 11. Out of Scope (v1.0)

- Dark mode token overrides (reserved for v2.0)
- Custom font file upload (`.woff2`) — Google Fonts and system stacks only in v1.0
- Per-page or per-category banner overrides beyond defined banner slots
- Animated or video banners
- A/B testing of brand configurations
- Admin-facing storefront theme marketplace
- CSS/code editor for advanced overrides (raw CSS injection)
- Mobile app branding (icons, splash screens)

---

## 12. Dependencies & Risks

### Dependencies

- Supabase Storage bucket configured for public CDN access per tenant
- Google Fonts API accessible at build/runtime for font metadata and loading
- Vercel edge cache invalidation API available for theme file purging on publish
- Coupon module API (for Promotional Strip ↔ Coupon integration in Section 5.2.5)
- Multi-tenant middleware resolving `tenant_id` server-side (Phase 0 prerequisite)

### Risks

| Risk | Mitigation |
|---|---|
| Admin publishes palette that fails WCAG contrast | Warn on save; block publish if primary text/background pair fails AA minimum |
| Large SVG upload contains malicious scripts | Server-side SVG sanitization using DOMPurify or equivalent before storage |
| Google Fonts API unavailable at storefront load time | Implement `font-display: swap` and system font fallbacks for all configured fonts |
| Theme CSS cache not invalidated after publish | Implement explicit Vercel cache purge on publish; include version hash in asset URL as fallback |
| Draft changes lost on session expiration | Autosave draft to DB every 30 seconds; warn user of unsaved changes on navigation away |
| Tenant branding config resolved incorrectly | Server-side tenant resolution enforced at API route level; never trust client-supplied tenant ID |
| High-resolution banner image degrades LCP | Enforce max upload size (5MB); generate WebP variants and serve via `<picture>` with `srcset` |
| Admin accidentally publishes incorrect config | Require confirmation modal with diff summary; retain last 10 versions for rollback |

---

## 13. Suggested Phasing

| Phase | Timeline | Scope |
|---|---|---|
| **Phase 1** | Weeks 1–3 | Logo upload (primary + favicon), Hero Banner with responsive heights + object position + viewport preview switcher, Publish / Revert flow, DB schema and storage setup |
| **Phase 2** | Weeks 4–6 | Color palette editor with WCAG contrast checker, theme preset selector, Promotional Strip banner, Category and Checkout banner slots |
| **Phase 3** | Weeks 7–9 | Typography configuration (Google Fonts integration, type scale), Button style editor (Primary / Secondary / Ghost), Form input styles |
| **Phase 4** | Weeks 10–12 | Version history and rollback UI, Logo variant management (reversed, OG image, Apple touch icon), Coupon ↔ Promotional Strip integration, Advanced overlay controls |

---

## 14. Open Questions

- Should a "Reset All to Defaults" option exist at the module level, or only per-section?
- For multi-tenant deployments: should tenants be allowed to inherit a parent brand config and override only specific tokens?
- Should the Google Fonts font list be cached locally (to avoid API dependency at admin load time)?
- What is the retention policy for archived banner images that have been replaced?
- Should the Preview Panel be collapsible to allow more editing space on smaller admin viewports?
- Is there a requirement to export the branding config as a JSON file for migration between environments (dev → staging → production)?
- Should button style configuration support individual overrides per specific component (e.g., "Add to Cart" button styled differently from the generic primary button)?
- Should the Promotional Strip support countdown timers (e.g., "Sale ends in 2:34:00")?

---

*End of Document — v1.0 Draft*
