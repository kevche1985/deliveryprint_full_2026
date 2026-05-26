"use client"

import { useLanguage } from "@/lib/language-context"

export default function PriceDisplay({ price }: { price: number }) {
  const { t } = useLanguage()
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-3">
        <p className="text-3xl font-semibold text-[#E84E3A]">${price.toFixed(2)}</p>
        <p className="text-sm text-gray-500">{t("product.starting_from")}</p>
      </div>
      <p className="text-xs text-gray-500">{t("product.price_disclaimer")}</p>
    </div>
  )
}

