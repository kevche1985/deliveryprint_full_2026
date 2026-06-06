"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { resolveMainBannerObjectFit, resolveMainBannerObjectPosition, type Breakpoint, type MainBannerConfig } from "@/lib/branding"

type Props = {
  loading: boolean
  draft: MainBannerConfig
  canPublish: boolean
  errors: string[]
}

export default function MainBannerPreview(props: Props) {
  const [viewport, setViewport] = useState<Breakpoint>("desktop")
  const previewHeight = props.draft.heights[viewport]
  const previewObjectPosition = resolveMainBannerObjectPosition(props.draft, viewport)
  const previewObjectFit = resolveMainBannerObjectFit(props.draft, viewport)

  const overlayBgStyle = useMemo(() => {
    if (!props.draft.overlay.enabled) return undefined
    const a = Math.max(0, Math.min(1, props.draft.overlay.bgOpacity / 100))
    if (props.draft.overlay.bgStyle === "none") return { backgroundColor: "transparent" }
    if (props.draft.overlay.bgStyle === "lightScrim") return { backgroundColor: `rgba(255,255,255,${a})` }
    return { backgroundColor: `rgba(0,0,0,${a})` }
  }, [props.draft.overlay])

  const overlayJustify =
    props.draft.overlay.position === "left" ? "flex-start" : props.draft.overlay.position === "right" ? "flex-end" : "center"

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Draft preview (unpublished)</CardDescription>
          </div>
          <Tabs value={viewport} onValueChange={(v) => setViewport(v as Breakpoint)}>
            <TabsList>
              <TabsTrigger value="mobile">Mobile</TabsTrigger>
              <TabsTrigger value="tablet">Tablet</TabsTrigger>
              <TabsTrigger value="desktop">Desktop</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-4 overflow-auto">
            <div className="w-full bg-black/10 rounded-md overflow-hidden" style={{ maxWidth: "100%" }}>
              <div className="px-4 py-2 text-xs bg-yellow-200 text-yellow-900">Preview — Unpublished changes</div>
              <div className="relative" style={{ height: previewHeight }}>
                {props.draft.imageUrl ? (
                  <img
                    src={props.draft.imageUrl}
                    alt="Preview banner"
                    className="absolute inset-0 w-full h-full"
                    style={{ objectFit: previewObjectFit, objectPosition: previewObjectPosition }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No banner image</div>
                )}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0))" }} />
                {props.draft.overlay.enabled && (
                  <div className="absolute inset-0 flex items-center px-6" style={{ justifyContent: overlayJustify }}>
                    <div className="max-w-xl rounded-md p-5" style={overlayBgStyle as any}>
                      <div className="text-3xl font-extrabold" style={{ color: props.draft.overlay.textColor }}>
                        {props.draft.overlay.headline || "Headline"}
                      </div>
                      {props.draft.overlay.subheadline && (
                        <div className="mt-2 text-base" style={{ color: props.draft.overlay.textColor }}>
                          {props.draft.overlay.subheadline}
                        </div>
                      )}
                      {props.draft.overlay.ctaLabel && (
                        <div className="mt-4">
                          <Button size="sm">{props.draft.overlay.ctaLabel}</Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!props.loading && !props.canPublish && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{props.errors.join(" • ")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
