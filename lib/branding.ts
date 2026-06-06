export type Breakpoint = "mobile" | "tablet" | "desktop"

export type BannerObjectFit = "cover" | "contain"

export type BannerOverlay = {
  enabled: boolean
  position: "left" | "center" | "right"
  headline: string
  subheadline: string
  ctaLabel: string
  ctaUrl: string
  bgStyle: "none" | "darkScrim" | "lightScrim" | "solid"
  bgOpacity: number
  textColor: string
}

export type MainBannerConfig = {
  imageUrl: string
  heights: Record<Breakpoint, number>
  objectPosition: string
  objectPositionByBreakpoint?: Partial<Record<Breakpoint, string>>
  objectFit?: BannerObjectFit
  objectFitByBreakpoint?: Partial<Record<Breakpoint, BannerObjectFit>>
  overlay: BannerOverlay
}

export type TenantBrandingConfig = {
  banners?: {
    hero?: MainBannerConfig
  }
}

export const defaultMainBannerConfig: MainBannerConfig = {
  imageUrl: "",
  heights: {
    mobile: 320,
    tablet: 380,
    desktop: 560,
  },
  objectPosition: "50% 50%",
  objectPositionByBreakpoint: {
    mobile: "50% 50%",
    tablet: "50% 50%",
    desktop: "50% 50%",
  },
  objectFit: "cover",
  objectFitByBreakpoint: {
    mobile: "cover",
    tablet: "cover",
    desktop: "cover",
  },
  overlay: {
    enabled: false,
    position: "center",
    headline: "",
    subheadline: "",
    ctaLabel: "",
    ctaUrl: "",
    bgStyle: "darkScrim",
    bgOpacity: 40,
    textColor: "#ffffff",
  },
}

export function normalizeHexColor(input: string): string {
  const s = (input || "").trim().toLowerCase()
  if (!s) return ""
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  }
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  return ""
}

export function coerceInt(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.trunc(v)
}

export function sanitizeObjectPosition(value: unknown, fallback: string): string {
  const s = typeof value === "string" ? value.trim() : ""
  if (!s) return fallback
  if (s.length > 32) return fallback
  return s
}

export function resolveMainBannerObjectPosition(config: MainBannerConfig, bp: Breakpoint): string {
  const base = defaultMainBannerConfig.objectPosition
  const fallback = sanitizeObjectPosition(config.objectPosition, base)
  return sanitizeObjectPosition(config.objectPositionByBreakpoint?.[bp], fallback)
}

export function resolveMainBannerObjectFit(config: MainBannerConfig, bp: Breakpoint): BannerObjectFit {
  const fallback: BannerObjectFit = config.objectFit === "contain" ? "contain" : "cover"
  const v = config.objectFitByBreakpoint?.[bp]
  return v === "contain" || v === "cover" ? v : fallback
}

export function normalizeMainBannerConfig(input: any): MainBannerConfig {
  const base = defaultMainBannerConfig
  const heightsIn = input?.heights || {}
  const overlayIn = input?.overlay || {}
  const posIn = input?.objectPositionByBreakpoint || {}
  const fitIn = input?.objectFit
  const fitByBpIn = input?.objectFitByBreakpoint || {}
  const fitFallback: BannerObjectFit = fitIn === "contain" ? "contain" : "cover"
  const posFallback = sanitizeObjectPosition(input?.objectPosition, base.objectPosition)

  const objectPositionByBreakpoint: Record<Breakpoint, string> = {
    mobile: sanitizeObjectPosition(posIn.mobile, posFallback),
    tablet: sanitizeObjectPosition(posIn.tablet, posFallback),
    desktop: sanitizeObjectPosition(posIn.desktop, posFallback),
  }

  const objectFitByBreakpoint: Record<Breakpoint, BannerObjectFit> = {
    mobile: fitByBpIn.mobile === "contain" || fitByBpIn.mobile === "cover" ? fitByBpIn.mobile : fitFallback,
    tablet: fitByBpIn.tablet === "contain" || fitByBpIn.tablet === "cover" ? fitByBpIn.tablet : fitFallback,
    desktop: fitByBpIn.desktop === "contain" || fitByBpIn.desktop === "cover" ? fitByBpIn.desktop : fitFallback,
  }

  const out: MainBannerConfig = {
    imageUrl: typeof input?.imageUrl === "string" ? input.imageUrl.trim() : base.imageUrl,
    heights: {
      mobile: clamp(coerceInt(heightsIn.mobile, base.heights.mobile), 100, 1200),
      tablet: clamp(coerceInt(heightsIn.tablet, base.heights.tablet), 100, 1200),
      desktop: clamp(coerceInt(heightsIn.desktop, base.heights.desktop), 100, 1200),
    },
    objectPosition: objectPositionByBreakpoint.desktop,
    objectPositionByBreakpoint,
    objectFit: fitFallback,
    objectFitByBreakpoint,
    overlay: {
      enabled: !!overlayIn.enabled,
      position: overlayIn.position === "left" || overlayIn.position === "right" || overlayIn.position === "center" ? overlayIn.position : base.overlay.position,
      headline: typeof overlayIn.headline === "string" ? overlayIn.headline.slice(0, 80) : base.overlay.headline,
      subheadline: typeof overlayIn.subheadline === "string" ? overlayIn.subheadline.slice(0, 160) : base.overlay.subheadline,
      ctaLabel: typeof overlayIn.ctaLabel === "string" ? overlayIn.ctaLabel.slice(0, 30) : base.overlay.ctaLabel,
      ctaUrl: typeof overlayIn.ctaUrl === "string" ? overlayIn.ctaUrl.trim().slice(0, 500) : base.overlay.ctaUrl,
      bgStyle:
        overlayIn.bgStyle === "none" || overlayIn.bgStyle === "darkScrim" || overlayIn.bgStyle === "lightScrim" || overlayIn.bgStyle === "solid"
          ? overlayIn.bgStyle
          : base.overlay.bgStyle,
      bgOpacity: clamp(coerceInt(overlayIn.bgOpacity, base.overlay.bgOpacity), 0, 100),
      textColor: normalizeHexColor(overlayIn.textColor) || base.overlay.textColor,
    },
  }

  if (!out.overlay.enabled) {
    out.overlay = { ...base.overlay, enabled: false }
  }

  return out
}

export function validateMainBannerConfig(config: MainBannerConfig): string[] {
  const errors: string[] = []
  if (!config.imageUrl) errors.push("Banner image is required")
  if (!isInRange(config.heights.mobile, 100, 1200)) errors.push("Mobile height must be 100–1200")
  if (!isInRange(config.heights.tablet, 100, 1200)) errors.push("Tablet height must be 100–1200")
  if (!isInRange(config.heights.desktop, 100, 1200)) errors.push("Desktop height must be 100–1200")

  if (config.overlay.enabled) {
    if (!config.overlay.headline) errors.push("Overlay headline is required")
    if (config.overlay.ctaLabel && !config.overlay.ctaUrl) errors.push("CTA URL is required when CTA label is set")
    if (!normalizeHexColor(config.overlay.textColor)) errors.push("Overlay text color must be a valid hex")
  }
  return errors
}

export function mergeTenantBrandingConfig(existing: any, hero: MainBannerConfig): TenantBrandingConfig {
  const cfg: TenantBrandingConfig = typeof existing === "object" && existing ? existing : {}
  return {
    ...cfg,
    banners: {
      ...(cfg.banners || {}),
      hero,
    },
  }
}

function isInRange(n: number, min: number, max: number) {
  return Number.isFinite(n) && n >= min && n <= max
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
