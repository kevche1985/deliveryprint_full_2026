"use client"

import type { ProductVariantGroup } from "./ProductDetailClient"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function VariantDropdowns({
  groups,
  selectedOptions,
  onChange,
}: {
  groups: ProductVariantGroup[]
  selectedOptions: Record<string, string>
  onChange: (groupId: string, optionId: string) => void
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-sm font-medium text-gray-900">{group.name}</p>
          <Select value={selectedOptions[group.id]} onValueChange={(v) => onChange(group.id, v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {group.options.map((o) => (
                <SelectItem key={o.id} value={o.id} disabled={!o.is_available}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}

