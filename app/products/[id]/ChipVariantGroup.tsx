"use client"

import type { ProductVariantGroup } from "./ProductDetailClient"

export default function ChipVariantGroup({
  group,
  selectedOptionId,
  onSelect,
}: {
  group: ProductVariantGroup
  selectedOptionId: string | undefined
  onSelect: (optionId: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{group.name}</p>
      <div className="flex flex-wrap gap-2">
        {group.options.map((o) => {
          const isSelected = o.id === selectedOptionId
          const isDisabled = !o.is_available
          return (
            <button
              key={o.id}
              type="button"
              className={[
                "rounded-full px-3 py-1 text-sm transition",
                isSelected ? "bg-gray-900 text-white" : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50",
                isDisabled ? "opacity-50 cursor-not-allowed hover:bg-white" : "",
              ].join(" ")}
              onClick={() => (isDisabled ? null : onSelect(o.id))}
              disabled={isDisabled}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

