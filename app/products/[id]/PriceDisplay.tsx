"use client"

import { useLanguage } from "@/lib/language-context"

export default function PriceDisplay({
  totalPrice,
  unitPrice,
  contextLine,
}: {
  totalPrice: number
  unitPrice?: number | null
  contextLine?: string | null
}) {
  const { t } = useLanguage()
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-3">
        <p className="text-3xl font-semibold text-[#8B0000]">${totalPrice.toFixed(2)}</p>
        <p className="text-sm text-gray-500">{t("product.totalLabel")}</p>
      </div>
      {contextLine ? (
        <p className="text-sm text-gray-500">{contextLine}</p>
      ) : unitPrice != null ? (
        <p className="text-sm text-gray-500">
          {t("product.fromLabel")} ${unitPrice.toFixed(2)} {t("product.eachLabel")}
        </p>
      ) : null}
      <p className="text-xs text-gray-500">{t("product.price_disclaimer")}</p>
    </div>
  )
}
