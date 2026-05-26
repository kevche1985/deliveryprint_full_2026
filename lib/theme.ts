export type ThemeConfig = {
  brandName: string
  slogan: string
  primaryColor: string
  accentColor: string
  logoUrl: string
  bannerImageUrl?: string
}

export function getTheme(): ThemeConfig {
  const envBanner = process.env.NEXT_PUBLIC_BANNER_IMAGE_URL
  const bannerImageUrl =
    envBanner && envBanner.includes("dzlqddocovzijnfwygap.supabase.co") && envBanner.includes("/web-images/banner_main.png")
      ? "/placeholder.jpg"
      : envBanner || "/placeholder.jpg"

  return {
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "DeliveryPrint",
    slogan: process.env.NEXT_PUBLIC_BRAND_SLOGAN || "Your Vision, Printed",
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || "#8B0000",
    accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR || "#6B0000",
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || "/logo-print.png",
    bannerImageUrl,
  }
}
