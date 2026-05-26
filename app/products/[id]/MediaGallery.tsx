"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ProductMedia } from "./ProductDetailClient"
import { ChevronLeft, ChevronRight, Play } from "lucide-react"
import { useLanguage } from "@/lib/language-context"

export default function MediaGallery({ items }: { items: ProductMedia[] }) {
  const { t } = useLanguage()
  const sorted = useMemo(() => items.slice().sort((a, b) => a.sortOrder - b.sortOrder), [items])
  const [activeIndex, setActiveIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setActiveIndex(0)
  }, [sorted.length])

  const active = sorted[activeIndex]

  const go = (nextIndex: number) => {
    if (sorted.length === 0) return
    const clamped = ((nextIndex % sorted.length) + sorted.length) % sorted.length
    setActiveIndex(clamped)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (sorted.length <= 1) return
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      go(activeIndex - 1)
    }
    if (e.key === "ArrowRight") {
      e.preventDefault()
      go(activeIndex + 1)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[88px_1fr]">
      <div className="order-2 flex gap-3 overflow-x-auto lg:order-1 lg:flex-col lg:overflow-x-visible">
        {sorted.map((item, idx) => {
          const isActive = idx === activeIndex
          return (
            <button
              key={item.id}
              type="button"
              className={[
                "relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border bg-white",
                isActive ? "border-2 border-[#E84E3A]" : "border-gray-200",
              ].join(" ")}
              onClick={() => setActiveIndex(idx)}
              aria-label={item.type === "video" ? `${item.alt} (video)` : item.alt}
            >
              {item.type === "image" ? (
                <img src={item.url} alt={item.alt} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                  <Play className="h-6 w-6 text-gray-600" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div
        ref={panelRef}
        tabIndex={0}
        className="order-1 relative aspect-square overflow-hidden rounded-lg bg-gray-50 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-[#E84E3A] lg:order-2"
        onKeyDown={onKeyDown}
      >
        {active ? (
          active.type === "image" ? (
            <img src={active.url} alt={active.alt} className="h-full w-full object-contain" loading="eager" />
          ) : (
            <video src={active.url} controls className="h-full w-full object-contain" />
          )
        ) : (
          <div className="h-full w-full" />
        )}

        {sorted.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
              onClick={() => go(activeIndex - 1)}
              aria-label={t("product.gallery_prev")}
            >
              <ChevronLeft className="h-5 w-5 text-gray-900" />
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
              onClick={() => go(activeIndex + 1)}
              aria-label={t("product.gallery_next")}
            >
              <ChevronRight className="h-5 w-5 text-gray-900" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
