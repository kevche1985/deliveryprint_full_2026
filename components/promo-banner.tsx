"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"

type Banner = {
  id: string
  headline: string
  supporting_text?: string | null
  cta_label?: string | null
  cta_url?: string | null
  bg_type?: string | null
  bg_value?: string | null
  text_color?: string | null
  position?: string | null
  code?: string | null
  updated_at?: string | null
}

export default function PromoBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [dismissKey, setDismissKey] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/banner/active", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (data && data.headline) {
          const key = `promoDismissed:${data.id}:${data.updated_at || ''}`
          setDismissKey(key)
          if (typeof window !== 'undefined' && sessionStorage.getItem(key) === '1') {
            setDismissed(true)
          } else {
            setBanner(data)
          }
        }
      } catch {}
    })()
  }, [])

  if (dismissed || !banner) return null

  const gradient = banner.bg_type === "image"
    ? undefined
    : banner.bg_value || "linear-gradient(90deg, #10b981, #059669)"
  const color = banner.text_color || "#fff"

  return (
    <div className="w-full" style={{ background: gradient }}>
      <div className="max-w-7xl mx-auto px-3">
        <div className="flex items-center justify-center gap-3 text-sm py-2" style={{ color }}>
          <span className="hidden sm:inline">🛒</span>
          <span className="font-medium">{banner.headline}</span>
          {banner.code && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 bg-white/10 hover:bg-white/20 border-white/30 text-white"
              onClick={() => {
                navigator.clipboard?.writeText(banner.code || "")
              }}
              title="Copy coupon code"
            >
              <Copy className="h-3 w-3 mr-1" /> {banner.code}
            </Button>
          )}
          {banner.cta_label && banner.cta_url && (
            <a href={banner.cta_url} className="underline underline-offset-4">{banner.cta_label}</a>
          )}
          <button
            aria-label="Dismiss promotion"
            className="ml-2 opacity-80 hover:opacity-100"
            onClick={() => { if (dismissKey) sessionStorage.setItem(dismissKey, '1'); setDismissed(true) }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
