"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"

export type SpecRow = { key: string; value: string }

export default function SpecificationsEditor({
  value,
  onChange,
  disabled,
}: {
  value: SpecRow[]
  onChange: (value: SpecRow[]) => void
  disabled?: boolean
}) {
  const update = (idx: number, next: SpecRow) => onChange(value.map((r, i) => (i === idx ? next : r)))

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_40px] gap-2">
            <Input
              value={row.key}
              onChange={(e) => update(idx, { ...row, key: e.target.value })}
              placeholder="Key"
              disabled={disabled}
            />
            <Input
              value={row.value}
              onChange={(e) => update(idx, { ...row, value: e.target.value })}
              placeholder="Value"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...value, { key: "", value: "" }])}>
        Add specification
      </Button>
    </div>
  )
}

