# Design System Strategy: The Premium Printmaker

This document outlines a signature visual identity designed to evolve the "Delivery Print" brand from a standard utility service into a premium, editorial-grade digital experience. By shifting away from rigid grids and default borders, we create a sense of tactile luxury—mimicking the high-quality physical paper and ink the brand provides.

---

## 1. Creative North Star: "The Digital Lithograph"
The core philosophy of this design system is **Sophisticated Precision**. We treat the UI not as a collection of digital widgets, but as a series of layered, high-end substrates. 

To break the "template" look, we employ:
*   **Intentional Asymmetry:** Overlapping image clusters and off-grid typography to guide the eye dynamically.
*   **Editorial Scaling:** Dramatically large display type paired with generous whitespace (kerning and line-height) to signal authority.
*   **Tonal Depth:** Replacing harsh lines with shifts in surface temperature and light.

---

## 2. Color & Surface Philosophy
The palette utilizes deep, heritage reds and forest greens to ground the brand in trustworthiness, while the neutral scale provides the "paper" on which the story is told.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections or containers. 
*   Boundaries must be created through background color shifts. For instance, a `surface-container-low` section should sit directly on a `background` or `surface` area.
*   The transition between content blocks should feel like the edge of a stack of paper, not a drawn box.

### Surface Hierarchy & Layering
We use the Material Design surface tiers to create physical depth:
*   **Level 0 (Base):** `surface` (#f9f9fc) for the main canvas.
*   **Level 1 (Inset):** `surface-container-low` (#f3f3f6) for secondary content tracks or sidebars.
*   **Level 2 (Lifted):** `surface-container-lowest` (#ffffff) for primary cards and interaction points.
*   **The Glass Rule:** For floating navigation or modals, use `surface` at 80% opacity with a `24px` backdrop blur. This "Glassmorphism" ensures the interface feels integrated and premium.

### Signature Textures
Avoid flat primary colors for large Hero areas. Instead, utilize a subtle linear gradient:
*   **Primary Gradient:** `primary` (#af101a) to `primary-container` (#d32f2f) at a 135-degree angle. This adds "ink density" and visual soul to the brand.

---

## 3. Typography: Editorial Authority
We pair **Manrope** (Headlines) with **Inter** (Body) to create a balance between modern geometry and functional legibility.

*   **Display (Manrope):** Use `display-lg` (3.5rem) for hero statements. Tighten letter-spacing by -0.02em to create a "locked-in" professional feel.
*   **Headline (Manrope):** `headline-lg` (2rem) is the workhorse for section headers. It should always be `on-surface` (#1a1c1e).
*   **Body (Inter):** Use `body-lg` (1rem) for descriptions. Increase line-height to 1.6 to ensure a breezy, high-end reading experience.
*   **Labels (Inter):** `label-md` should be used sparingly for "overlines" above titles, set in all-caps with +0.05em letter spacing to denote a curated categorization.

---

## 4. Elevation & Depth
Depth is a functional tool, not a decorative one. We move away from "drop shadows" in favor of **Tonal Layering**.

*   **The Layering Principle:** Place a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f3f3f6) background. The delta in color provides enough contrast to signify an interactive element without visual clutter.
*   **Ambient Shadows:** If a card requires a floating state (e.g., on hover), use a shadow with a 40px blur and 4% opacity, using the `on-surface` color as the shadow base.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., input fields), use `outline-variant` (#e4beba) at **20% opacity**. Never use 100% opaque borders.

---

## 5. Modernized Components

### Buttons (The "Precision Tap")
*   **Primary:** A gradient-fill using the Primary Gradient. Corner radius set to `md` (0.375rem). No border.
*   **Secondary:** Ghost-style. Use the "Ghost Border" (20% `outline-variant`) with `primary` text.
*   **Interaction:** On hover, the button should lift slightly using a `2px` vertical translation and an Ambient Shadow.

### Cards & Lists
*   **Strict Rule:** No dividers. Separate list items using `spacing-4` (1rem) or `spacing-6` (1.5rem).
*   **Product Cards:** Use `surface-container-lowest` with a "Ghost Border." The image should occupy 60% of the card height, bled to the top and sides.

### Input Fields
*   **Style:** Minimalist. `surface-container-lowest` background with a bottom-only "Ghost Border." 
*   **States:** On focus, the bottom border transitions to 100% `primary` (#af101a) with a 2px thickness.

### Signature Component: The "Process Stepper"
For the Print-On-Demand context, use an asymmetric stepper. Instead of a horizontal line, use large, low-opacity `display-lg` numbers as background elements behind the `title-lg` step description.

---

## 6. Do’s and Don'ts

### Do:
*   **DO** use `secondary` (#006c4b) for success states, trust badges, and "Ready for Pickup" indicators to provide a sophisticated contrast to the red.
*   **DO** utilize the full `spacing-24` (6rem) for section padding. Negative space is the primary indicator of luxury.
*   **DO** use "Glassmorphism" for the top navigation bar to let hero imagery bleed through the header.

### Don't:
*   **DON'T** use 1px solid dividers to separate content. Use a `surface-container` background shift instead.
*   **DON'T** use pure black (#000000). Always use `on-surface` (#1a1c1e) for text to maintain a softer, editorial tone.
*   **DON'T** use "full" rounded corners (pills) for primary buttons; stick to the `md` (0.375rem) or `lg` (0.5rem) scale to maintain a professional, structured look.