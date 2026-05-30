"use client"

import { useLanguage } from "@/lib/language-context"

export default function PriceDisplay({ unitPrice, quantity }: { unitPrice: number; quantity: number }) {
  const { t } = useLanguage()
  const total = unitPrice * quantity
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-3">
        <p className="text-3xl font-semibold text-[#E84E3A]">${total.toFixed(2)}</p>
        <p className="text-sm text-gray-500">{t("product.totalLabel")}</p>
      </div>
      <p className="text-sm text-gray-500">
        {t("product.fromLabel")} ${unitPrice.toFixed(2)} {t("product.eachLabel")}
      </p>
      <p className="text-xs text-gray-500">{t("product.price_disclaimer")}</p>
    </div>
  )
}
