"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { resolveMainBannerObjectFit, resolveMainBannerObjectPosition, type BannerObjectFit, type Breakpoint, type MainBannerConfig } from "@/lib/branding"

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
  const [viewport, setViewport] = useState<Breakpoint>("desktop")
  const normalizedPos = resolveMainBannerObjectPosition(props.normalizedDraft, viewport)
  const normalizedFit = resolveMainBannerObjectFit(props.normalizedDraft, viewport)
  const preset = formatObjectPositionPreset(normalizedPos)

  const focal = useMemo(() => {
    const m = normalizedPos.match(/^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/)
    if (!m) return null
    const x = Number(m[1])
    const y = Number(m[2])
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }, [normalizedPos])

  const draftPosValue = props.draft.objectPositionByBreakpoint?.[viewport] ?? props.draft.objectPosition
  const draftFitValue: BannerObjectFit = (props.draft.objectFitByBreakpoint?.[viewport] ??
    props.draft.objectFit ??
    "cover") as BannerObjectFit

  function updateObjectPosition(nextPos: string) {
    const nextByBp = { ...(props.draft.objectPositionByBreakpoint || {}), [viewport]: nextPos }
    const next: MainBannerConfig = { ...props.draft, objectPositionByBreakpoint: nextByBp }
    if (viewport === "desktop") next.objectPosition = nextPos
    props.onChangeDraft(next)
  }

  function updateObjectFit(nextFit: BannerObjectFit) {
    const nextByBp = { ...(props.draft.objectFitByBreakpoint || {}), [viewport]: nextFit }
    const next: MainBannerConfig = { ...props.draft, objectFitByBreakpoint: nextByBp }
    if (viewport === "desktop") next.objectFit = nextFit
    props.onChangeDraft(next)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focal Point</CardTitle>
        <CardDescription>Controls the visible crop at different sizes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={viewport} onValueChange={(v) => setViewport(v as Breakpoint)}>
          <TabsList>
            <TabsTrigger value="mobile">Mobile</TabsTrigger>
            <TabsTrigger value="tablet">Tablet</TabsTrigger>
            <TabsTrigger value="desktop">Desktop</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-sm text-muted-foreground">Fit</div>
          <Button type="button" variant={normalizedFit === "cover" ? "default" : "outline"} onClick={() => updateObjectFit("cover")}>
            cover
          </Button>
          <Button type="button" variant={normalizedFit === "contain" ? "default" : "outline"} onClick={() => updateObjectFit("contain")}>
            contain
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["top", "center", "bottom", "left", "right"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant={preset === p ? "default" : "outline"}
              onClick={() => updateObjectPosition(presetToObjectPosition(p))}
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
            value={draftPosValue}
            onChange={(e) => updateObjectPosition(e.target.value)}
            placeholder='e.g. "50% 30%"'
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>X (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={focal?.x ?? 50}
              onChange={(e) => {
                const x = Number(e.target.value)
                const px = Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50
                const py = focal?.y ?? 50
                updateObjectPosition(`${px.toFixed(1)}% ${py.toFixed(1)}%`)
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Y (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={focal?.y ?? 50}
              onChange={(e) => {
                const y = Number(e.target.value)
                const py = Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50
                const px = focal?.x ?? 50
                updateObjectPosition(`${px.toFixed(1)}% ${py.toFixed(1)}%`)
              }}
            />
          </div>
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
              updateObjectPosition(`${px.toFixed(1)}% ${py.toFixed(1)}%`)
            }}
          >
            {props.normalizedDraft.imageUrl ? (
              <img
                src={props.normalizedDraft.imageUrl}
                alt="Focal"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: normalizedFit, objectPosition: normalizedPos }}
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
