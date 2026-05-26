"use client"

import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"

export default function QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useLanguage()

  const clamp = (n: number) => Math.max(1, Math.min(999, n))

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{t("product.quantity_label")}</p>
      <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
        <Button type="button" variant="outline" disabled={value <= 1} onClick={() => onChange(clamp(value - 1))}>
          −
        </Button>
        <input
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-center text-sm"
          value={String(value)}
          inputMode="numeric"
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10)
            if (Number.isFinite(n)) onChange(clamp(n))
            if (e.target.value === "") onChange(1)
          }}
          onBlur={() => onChange(clamp(value))}
        />
        <Button type="button" variant="outline" onClick={() => onChange(clamp(value + 1))}>
          +
        </Button>
      </div>
    </div>
  )
}

