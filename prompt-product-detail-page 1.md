# Coding Prompt — Product Detail Page (DeliveryPrint)

> **Scope:** Full product detail page (`/products/[id]`) for the DeliveryPrint storefront, plus the corresponding admin product form to support multi-image/media upload and a flexible variant system (dropdown groups with sub-options).
> **Stack:** Next.js 14 App Router · React 18 · TypeScript · Tailwind CSS · shadcn/ui · Supabase

---

## Context

DeliveryPrint is a custom printing e-commerce platform. Products can be physical (posters, business cards, etc.) or digital. The product detail page must handle two distinct variant presentation modes depending on how the admin configures the product:

- **Chip grid** — for size-like variants where all options are visible at once (e.g. poster sizes: `5"×7"`, `8"×10"`, …)
- **Dropdown groups** — for named option groups where each group has its own label and a set of sub-options rendered as a `<Select>` (e.g. "Como quieres tus cartas" → Dos caras / Una cara; "¿Quieres tus cartas laminadas?" → Sí, mate / Sí, brillante / No)

Both modes co-exist: a product can have zero or more dropdown variant groups AND zero or one chip-grid variant group. The selected combination of options determines the resolved price.

Additionally, products that accept customer-supplied artwork (e.g. business cards) expose a **file upload zone**, a **design URL field**, and a **notes field** — all admin-configurable per product.

---

## 1. Storefront — Product Detail Page (`/products/[id]`)

### 1.1 Image & Media Gallery

Two-panel layout:

- **Thumbnail strip** (left, vertical on desktop / horizontal scrolling below image on mobile): all product media items. Active thumbnail highlighted with a `2px solid` vermillion border (`#E84E3A`). Click to change main view.
- **Main media panel**: renders the active item. Supports:
  - `type: 'image'` → `<img>` with lazy loading (first item eager)
  - `type: 'video'` → `<video controls>` with a poster frame
- Left/right chevron arrows overlaid on the panel; hidden when only one item.
- Fully keyboard accessible: arrow keys cycle items when panel is focused; Tab moves between thumbnails.

```typescript
interface ProductMedia {
  id: string
  url: string           // signed Supabase Storage URL
  type: 'image' | 'video'
  alt: string           // for images
  sort_order: number
}
```

### 1.2 Product Information Panel

Rendered to the right of the gallery (stacks below on mobile). Fields in order:

1. **Product name** — `h1`, Playfair Display
2. **Base price line** — e.g. `$36.25` (large, vermillion) + `(Starting from – varies by option)` (small, muted). Price updates reactively when variants are selected.
3. **Dropdown variant groups** — see §1.3
4. **Short description** — one-line product summary text (`products.short_description`)
5. **File upload zone** — see §1.4 (rendered only if `products.accepts_uploads = true`)
6. **Design URL field** — see §1.5 (rendered only if `products.accepts_uploads = true`)
7. **Notes field** — see §1.6 (rendered only if `products.accepts_uploads = true`)
8. **Chip-grid variant group** — see §1.7 (rendered only if `products.chip_variant_group_id` is set; some products use dropdowns only, some use chips only, some use both)
9. **Quantity stepper** — see §1.8
10. **Primary CTA — "Add to cart"** — see §1.9
11. **Secondary actions row** — "Save" (heart icon) + "Share" (share icon), side by side
12. **Tab bar** — "Product details" tab and "Customize design" tab (see §1.10)

### 1.3 Dropdown Variant Groups

For each `ProductVariantGroup` with `display: 'dropdown'`:

- Render a labeled `<Select>` (shadcn/ui `Select` component).
- Label is the group name (e.g. "Como quieres tus cartas").
- Options are the sub-variants (`VariantOption.label`), e.g. "Dos caras", "Una cara".
- First option is selected by default.
- When any dropdown changes, recompute the resolved price (see §2.3 for price resolution logic).
- Groups are rendered in `sort_order` order.

```typescript
interface ProductVariantGroup {
  id: string
  product_id: string
  name: string                        // e.g. 'Como quieres tus cartas'
  display: 'dropdown' | 'chips'
  sort_order: number
  options: VariantOption[]
}

interface VariantOption {
  id: string
  group_id: string
  label: string                       // e.g. 'Dos caras'
  price_modifier: number              // delta added to base price; 0 = no change
  is_available: boolean
  sort_order: number
}
```

### 1.4 File Upload Zone

Rendered below the short description when `products.accepts_uploads = true`.

- Section label: "Cargar archivos" (i18n key `product.upload_label`)
- Sub-label: "Sube tu diseño listo para imprimir. Acepta: PDF, PSD, AI, EPS, SVG, PNG, JPG." (i18n key `product.upload_hint`)
- **Drop zone**: dashed border box. Text: "Arrastra archivos aquí o haz clic para explorar" with an upload icon. Right-aligned "Cargar archivos" button as a secondary action inside the box.
- Constraints shown below: "Hasta 10 archivos · Máx 50MB cada uno"
- Files are uploaded to Supabase Storage bucket `order-uploads` under path `orders/pending/{sessionId}/{filename}`. The session-level path is resolved client-side; the actual `order_id` is attached server-side after order creation.
- Per-file: show filename, size, a progress bar, and a remove (✕) button.
- Accepted MIME types: `application/pdf, image/png, image/jpeg, image/svg+xml, .ai, .eps, .psd`

```typescript
interface UploadedFile {
  id: string             // local uuid, not yet in DB
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
  progress: number       // 0–100
  storagePath?: string   // set when status = 'done'
}
```

### 1.5 Design URL Field

- Label: "URL del diseño (opcional)" (i18n key `product.design_url_label`)
- `<Input>` with a link icon prefix and placeholder "Pega un enlace de Canva/Drive/Dropbox"
- Validate on blur: must be a valid URL or empty. Show inline error if invalid.
- Value stored in cart item metadata.

### 1.6 Notes Field

- Label: "Notas (opcional)" (i18n key `product.notes_label`)
- `<Textarea>` with placeholder "Agrega instrucciones (tamaño, sangrado, colores, acabado, etc.)"
- 4 rows visible; resizable vertically.
- Value stored in cart item metadata.

### 1.7 Chip-Grid Variant Group

For the single `ProductVariantGroup` with `display: 'chips'` (if present):

- Label above the grid (group name).
- Chip grid: one button per option. Layout: `flex-wrap`.
- Selected chip: dark filled background, white text.
- Unselected: white background, light border. Hover: light tint.
- Unavailable option: reduced opacity, `cursor-not-allowed`, non-selectable.
- Selecting a chip recomputes the resolved price.

### 1.8 Quantity Stepper

- Label: "Cantidad" (i18n key `product.quantity_label`)
- Three-element row: `[−]` button · centered number input · `[+]` button.
- Minimum: 1. Maximum: 999.
- `−` button disabled at quantity = 1.
- Direct input allowed; clamp to [1, 999] on blur.

### 1.9 Primary CTA — Add to Cart

- Full-width, vermillion background (`#E84E3A`), white bold text, cart icon prefix.
- Label: "Agregar al carrito" (i18n key `product.cta_add_to_cart`).
- On click: dispatch `addToCart` with:
  ```typescript
  {
    productId: string
    selectedOptions: Record<groupId, optionId>   // all dropdown + chip selections
    quantity: number
    uploadedFiles: UploadedFile[]                // storage paths of done uploads
    designUrl: string | null
    notes: string | null
  }
  ```
- Disabled + spinner while cart mutation is in flight.
- After success: show toast "Added to cart" and reset upload state.

### 1.10 Tab Bar — Product Details / Customize Design

Below the CTA panel, a two-tab section spanning full width:

- Tab 1: **"Detalles del producto"** — two-column layout:
  - Left: "Especificaciones del producto" section (renders `products.specifications` JSON as a key-value list)
  - Right: "Información de envío" section (renders `products.shipping_info` as formatted text)
- Tab 2: **"Personalizar diseño"** — renders a placeholder for the AI Studio embed or a "Start designing" CTA that links to `/ai-studio?productId=[id]`. Only rendered if `products.is_customizable = true`; otherwise the tab is hidden.

---

## 2. Data Layer

### 2.1 Schema Changes

```sql
-- products table additions
ALTER TABLE products
  ADD COLUMN short_description  text,
  ADD COLUMN technique          text,
  ADD COLUMN has_archive_guide  boolean DEFAULT false,
  ADD COLUMN accepts_uploads    boolean DEFAULT false,
  ADD COLUMN is_customizable    boolean DEFAULT false,
  ADD COLUMN rating             numeric(2,1),
  ADD COLUMN review_count       integer,
  ADD COLUMN wholesale_tiers    jsonb,
  ADD COLUMN specifications     jsonb,   -- [{key: 'Material', value: '350gsm'}]
  ADD COLUMN shipping_info      text;

-- product_media (replaces single image column)
CREATE TABLE product_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid REFERENCES products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  type         text NOT NULL CHECK (type IN ('image','video')),
  alt_text     text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- product_variant_groups
CREATE TABLE product_variant_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES products(id) ON DELETE CASCADE,
  name        text NOT NULL,
  display     text NOT NULL CHECK (display IN ('dropdown','chips')),
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- product_variant_options
CREATE TABLE product_variant_options (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid REFERENCES product_variant_groups(id) ON DELETE CASCADE,
  label          text NOT NULL,
  price_modifier numeric(10,2) NOT NULL DEFAULT 0,
  is_available   boolean DEFAULT true,
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
```

RLS policies — follow existing project pattern:
- `product_media`, `product_variant_groups`, `product_variant_options`: public `SELECT`; `INSERT/UPDATE/DELETE` restricted to admin role (check `auth.jwt() ->> 'role' = 'admin'` or service role).

### 2.2 Server-Side Data Fetching

```typescript
// app/products/[id]/page.tsx (Server Component)
const { data: product } = await supabase
  .from('products')
  .select(`
    *,
    product_media ( id, storage_path, type, alt_text, sort_order ),
    product_variant_groups (
      id, name, display, sort_order,
      product_variant_options ( id, label, price_modifier, is_available, sort_order )
    )
  `)
  .eq('id', params.id)
  .single()

// Resolve signed URLs server-side — never expose service key to client
const media = await Promise.all(
  product.product_media
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(async (item) => {
      const { data } = await supabase.storage
        .from('product-media')
        .createSignedUrl(item.storage_path, 3600)
      return { ...item, url: data?.signedUrl ?? '' }
    })
)
```

### 2.3 Client-Side Price Resolution

```typescript
// Computed in ProductDetailClient.tsx — pure function, no API call needed
function resolvePrice(
  basePrice: number,
  variantGroups: ProductVariantGroup[],
  selectedOptions: Record<string, string>  // groupId → optionId
): number {
  return variantGroups.reduce((price, group) => {
    const selectedOptionId = selectedOptions[group.id]
    const option = group.options.find(o => o.id === selectedOptionId)
    return price + (option?.price_modifier ?? 0)
  }, basePrice)
}
```

---

## 3. Admin Portal — Product Form

### 3.1 Media Manager

Replace the existing single-image field with a **media manager** component:

- **Drop zone**: accepts images and videos. `accept="image/*, video/mp4, video/webm"`. Max 10 files, 50MB each.
- **Media grid**: thumbnail cards for each uploaded item. Video thumbnails show a play icon overlay.
- Each card:
  - Drag handle (⠿) for reordering → updates `sort_order` via batch upsert
  - Delete (✕) → removes from Supabase Storage + deletes DB row
  - Alt text input (images only)
  - Type badge: "image" or "video"
- First card labeled **"Main"** badge.
- Upload progress bar per file.

### 3.2 Variant Group Builder

A dedicated **"Variant Groups"** section in the product form. Supports creating and managing multiple groups.

#### Group list

Each group is displayed as an expandable card showing:
- Group name (editable inline)
- Display type toggle: **Dropdown** | **Chips** (radio buttons)
- Sort order (drag handle)
- Delete group button (with confirmation if options exist)
- Expanded: the options list (§3.2.1)

#### 3.2.1 Options list (inside each group card)

A table with columns: **Label** · **Price modifier** (±MXN) · **Available** (toggle) · **⠿** (drag) · **✕** (delete).

- **Add option** inline row at the bottom: text input for label + number input for price_modifier + Save/Cancel.
- Options sortable via drag-and-drop.
- Price modifier field accepts negative values (discount) and positive values (surcharge). Prefix display: show `+` for positive, `−` for negative.

#### 3.2.2 Add group

"+ Add variant group" button below the group list. Clicking inserts a new blank group card in edit mode. Admin sets name and display type before saving.

#### 3.2.3 Validation

- Each group must have a name and at least one option before the product can be saved as active.
- Display inline error per group if validation fails on attempted save.

### 3.3 Upload Settings Toggles

In the product form's settings section, add:

- **Accepts file uploads** (toggle) — controls `accepts_uploads`. When enabled, shows the file upload zone, design URL, and notes fields on the storefront.
- **Is customizable** (toggle) — controls `is_customizable`. When enabled, shows the "Customize design" tab.

### 3.4 Specifications Editor

A structured key-value editor for `products.specifications`:

- List of rows: `[Key input] [Value input] [Delete]`
- "Add specification" button appends a blank row.
- Saves as `[{key, value}]` JSON array.

### 3.5 Complete Admin Form Field Order

1. Product name
2. Short description
3. Long description (existing rich text)
4. Category (dropdown)
5. Technique
6. Has archive guide (toggle)
7. Is active / Is featured (toggles)
8. Accepts file uploads (toggle) ← new
9. Is customizable (toggle) ← new
10. **Media** (new media manager — §3.1)
11. **Variant Groups** (new — §3.2)
12. **Specifications** (new — §3.4)
13. Shipping info (textarea)
14. Wholesale tiers (structured tier builder or textarea for MVP)
15. Rating / Review count (optional override fields)

---

## 4. i18n Keys

Add to both `en` and `es` translation objects:

```typescript
// English
{
  "product.starting_from": "Starting from – varies by option",
  "product.upload_label": "Upload files",
  "product.upload_hint": "Upload your print-ready design. Accepts: PDF, PSD, AI, EPS, SVG, PNG, JPG.",
  "product.upload_drop": "Drag files here or click to browse",
  "product.upload_constraints": "Up to 10 files · Max 50MB each",
  "product.upload_button": "Upload files",
  "product.design_url_label": "Design URL (optional)",
  "product.design_url_placeholder": "Paste a Canva/Drive/Dropbox link",
  "product.notes_label": "Notes (optional)",
  "product.notes_placeholder": "Add instructions (size, bleed, colors, finish, etc.)",
  "product.quantity_label": "Quantity",
  "product.cta_add_to_cart": "Add to cart",
  "product.save": "Save",
  "product.share": "Share",
  "product.tab_details": "Product details",
  "product.tab_customize": "Customize design",
  "product.specs_heading": "Product specifications",
  "product.shipping_heading": "Shipping information",
  "product.price_disclaimer": "* Price varies based on production technique, placement, color, product size, taxes and shipping.",
  "product.added_to_cart": "Added to cart"
}
```

```typescript
// Spanish
{
  "product.starting_from": "Desde – varía según la opción",
  "product.upload_label": "Cargar archivos",
  "product.upload_hint": "Sube tu diseño listo para imprimir. Acepta: PDF, PSD, AI, EPS, SVG, PNG, JPG.",
  "product.upload_drop": "Arrastra archivos aquí o haz clic para explorar",
  "product.upload_constraints": "Hasta 10 archivos · Máx 50MB cada uno",
  "product.upload_button": "Cargar archivos",
  "product.design_url_label": "URL del diseño (opcional)",
  "product.design_url_placeholder": "Pega un enlace de Canva/Drive/Dropbox",
  "product.notes_label": "Notas (opcional)",
  "product.notes_placeholder": "Agrega instrucciones (tamaño, sangrado, colores, acabado, etc.)",
  "product.quantity_label": "Cantidad",
  "product.cta_add_to_cart": "Agregar al carrito",
  "product.save": "Guardar",
  "product.share": "Compartir",
  "product.tab_details": "Detalles del producto",
  "product.tab_customize": "Personalizar diseño",
  "product.specs_heading": "Especificaciones del producto",
  "product.shipping_heading": "Información de envío",
  "product.price_disclaimer": "* El precio varía en función de la técnica de producción, de la colocación de la impresión, del color y el tamaño del producto, de los impuestos y del envío.",
  "product.added_to_cart": "Añadido al carrito"
}
```

---

## 5. File Structure

```
app/
  products/
    [id]/
      page.tsx                    ← Server component: fetch + sign URLs + pass props
      ProductDetailClient.tsx     ← Client: orchestrates all sub-components + state
      MediaGallery.tsx            ← Thumbnail strip + main panel + arrow nav
      VariantDropdowns.tsx        ← Dropdown group renderer
      ChipVariantGroup.tsx        ← Chip grid renderer
      FileUploadZone.tsx          ← Drop zone + per-file progress list
      QuantityStepper.tsx         ← − / input / + stepper
      ProductTabs.tsx             ← Details / Customize tab bar + panels
      PriceDisplay.tsx            ← Reactive price + "starting from" label

app/admin/
  products/
    _components/
      MediaManager.tsx            ← New: drag-drop image+video manager
      VariantGroupBuilder.tsx     ← New: group cards + options table
      SpecificationsEditor.tsx    ← New: key-value list editor

supabase/
  migrations/
    YYYYMMDDHHMMSS_product_media_and_variants.sql
```

---

## 6. Acceptance Criteria

### Storefront
- [ ] Gallery renders all images and videos; thumbnail strip and arrow navigation both work; video items show inline player.
- [ ] Each dropdown variant group renders a labeled `<Select>` with all its options.
- [ ] Selecting any option (dropdown or chip) reactively updates the displayed price using the pure `resolvePrice` function.
- [ ] File upload zone appears only when `accepts_uploads = true`; accepts specified MIME types; shows per-file progress; allows removal before add-to-cart.
- [ ] Design URL field validates on blur; notes textarea resizes vertically.
- [ ] Quantity stepper clamps to [1, 999]; `−` disabled at 1.
- [ ] "Add to cart" dispatches full cart item payload including selected options, uploaded file paths, design URL, and notes.
- [ ] "Customize design" tab visible only when `is_customizable = true`.
- [ ] "Product details" tab renders specs as key-value list and shipping info as text.
- [ ] All strings use i18n keys; Spanish and English both work.
- [ ] Page is keyboard navigable and meets WCAG AA contrast.

### Admin
- [ ] Admin can upload images and videos, reorder via drag-and-drop, set alt text, and delete individual items.
- [ ] Admin can create multiple variant groups, set display type (dropdown vs chips), add/reorder/delete options, and set price modifiers per option.
- [ ] Product cannot be saved as active without at least one variant group with at least one option (unless product has no variant groups at all — flat-price products are allowed).
- [ ] Specifications editor saves as JSON array and renders correctly on storefront.
- [ ] All signed media URLs are generated server-side; service role key never reaches the client.
- [ ] RLS policies applied to `product_media`, `product_variant_groups`, `product_variant_options`.

---

## 7. Out of Scope

- Customer reviews / ratings submission (display only).
- Real-time carrier shipping rate API (admin sets a flat estimate).
- Design Studio internals (only the tab placeholder and CTA link are in scope).
- Order-level file management after checkout (storage path association to `order_id` is a separate task).
