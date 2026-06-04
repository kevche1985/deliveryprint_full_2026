"use client"

import { useLanguage } from "@/lib/language-context"

export default function PriceDisplay({
  totalPrice,
  unitPrice,
  contextLine,
  disclaimer,
}: {
  totalPrice: number
  unitPrice?: number | null
  contextLine?: string | null
  disclaimer?: string | null
}) {
  const { t } = useLanguage()
  const baseDisclaimer = disclaimer?.trim() ? disclaimer.trim() : t("product.price_disclaimer")
  const resolvedDisclaimer =
    (baseDisclaimer.startsWith('"') && baseDisclaimer.endsWith('"')) || (baseDisclaimer.startsWith("“") && baseDisclaimer.endsWith("”"))
      ? baseDisclaimer.slice(1, -1).trim()
      : baseDisclaimer
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
      <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{resolvedDisclaimer}</p>
    </div>
  )
}
