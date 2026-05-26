"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MainBannerConfig } from "@/lib/branding"

type Props = {
  draft: MainBannerConfig
  normalizedDraft: MainBannerConfig
  onChangeDraft: (next: MainBannerConfig) => void
}

function formatObjectPositionPreset(pos: string) {
  const s = pos.trim().toLowerCase()
  if (s === "50% 0%" || s === "top" || s === "center top") return "top"
  if (s === "50% 50%" || s === "center" || s === "center center") return "center"
  if (s === "50% 100%" || s === "bottom" || s === "center bottom") return "bottom"
  if (s === "0% 50%" || s === "left" || s === "left center") return "left"
  if (s === "100% 50%" || s === "right" || s === "right center") return "right"
  return "custom"
}

function presetToObjectPosition(preset: string) {
  if (preset === "top") return "50% 0%"
  if (preset === "bottom") return "50% 100%"
  if (preset === "left") return "0% 50%"
  if (preset === "right") return "100% 50%"
  return "50% 50%"
}

export default function MainBannerFocalCard(props: Props) {
  const preset = formatObjectPositionPreset(props.normalizedDraft.objectPosition)

  const focal = useMemo(() => {
    const m = props.normalizedDraft.objectPosition.match(/^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/)
    if (!m) return null
    const x = Number(m[1])
    const y = Number(m[2])
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [props.normalizedDraft.objectPosition])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focal Point</CardTitle>
        <CardDescription>Controls the visible crop at different sizes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["top", "center", "bottom", "left", "right"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant={preset === p ? "default" : "outline"}
              onClick={() => props.onChangeDraft({ ...props.draft, objectPosition: presetToObjectPosition(p) })}
            >
              {p}
            </Button>
          ))}
          <Button type="button" variant={preset === "custom" ? "default" : "outline"}>
            custom
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Object position</Label>
          <Input
            value={props.draft.objectPosition}
            onChange={(e) => props.onChangeDraft({ ...props.draft, objectPosition: e.target.value })}
            placeholder='e.g. "50% 30%"'
          />
        </div>

        <div className="space-y-2">
          <Label>Click to set focal point</Label>
          <div
            className="relative w-full aspect-[16/9] rounded-md border overflow-hidden bg-muted cursor-crosshair"
            onClick={(e) => {
              const el = e.currentTarget
              const rect = el.getBoundingClientRect()
              const x = ((e.clientX - rect.left) / rect.width) * 100
              const y = ((e.clientY - rect.top) / rect.height) * 100
              const px = Math.max(0, Math.min(100, x))
              const py = Math.max(0, Math.min(100, y))
              props.onChangeDraft({ ...props.draft, objectPosition: `${px.toFixed(1)}% ${py.toFixed(1)}%` })
            }}
          >
            {props.normalizedDraft.imageUrl ? (
              <img
                src={props.normalizedDraft.imageUrl}
                alt="Focal"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: props.normalizedDraft.objectPosition }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Upload an image first</div>
            )}
            {focal && (
              <div
                className="absolute h-4 w-4 rounded-full border-2 border-white shadow"
                style={{ left: `calc(${focal.x}% - 8px)`, top: `calc(${focal.y}% - 8px)` }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

