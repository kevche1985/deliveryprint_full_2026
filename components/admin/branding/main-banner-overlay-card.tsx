"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MainBannerConfig } from "@/lib/branding"

type Props = {
  draft: MainBannerConfig
  draftErrors: string[]
  onChangeDraft: (next: MainBannerConfig) => void
}

export default function MainBannerOverlayCard(props: Props) {
  const overlayErrors = props.draftErrors.filter((e) => e.toLowerCase().includes("overlay") || e.toLowerCase().includes("cta"))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overlay</CardTitle>
        <CardDescription>Optional headline and CTA on top of the banner</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={props.draft.overlay.enabled}
            onCheckedChange={(v) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, enabled: v } })}
          />
          <span className="text-sm">Enable overlay</span>
        </div>

        {props.draft.overlay.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Position</Label>
              <Tabs
                value={props.draft.overlay.position}
                onValueChange={(v) => {
                  if (v === "left" || v === "center" || v === "right") {
                    props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, position: v } })
                  }
                }}
              >
                <TabsList>
                  <TabsTrigger value="left">Left</TabsTrigger>
                  <TabsTrigger value="center">Center</TabsTrigger>
                  <TabsTrigger value="right">Right</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="col-span-2">
              <Label>Headline</Label>
              <Input value={props.draft.overlay.headline} onChange={(e) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, headline: e.target.value } })} maxLength={80} />
            </div>

            <div className="col-span-2">
              <Label>Subheadline</Label>
              <Input value={props.draft.overlay.subheadline} onChange={(e) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, subheadline: e.target.value } })} maxLength={160} />
            </div>

            <div>
              <Label>CTA Label</Label>
              <Input value={props.draft.overlay.ctaLabel} onChange={(e) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, ctaLabel: e.target.value } })} maxLength={30} />
            </div>
            <div>
              <Label>CTA URL</Label>
              <Input value={props.draft.overlay.ctaUrl} onChange={(e) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, ctaUrl: e.target.value } })} placeholder="/products" />
            </div>

            <div>
              <Label>Background</Label>
              <Select value={props.draft.overlay.bgStyle} onValueChange={(v) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, bgStyle: v as any } })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="darkScrim">Dark scrim</SelectItem>
                  <SelectItem value="lightScrim">Light scrim</SelectItem>
                  <SelectItem value="solid">Solid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opacity (0–100)</Label>
              <Input type="number" value={props.draft.overlay.bgOpacity} onChange={(e) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, bgOpacity: Number(e.target.value || 0) } })} />
            </div>

            <div>
              <Label>Text color</Label>
              <Input type="color" value={props.draft.overlay.textColor} onChange={(e) => props.onChangeDraft({ ...props.draft, overlay: { ...props.draft.overlay, textColor: e.target.value } })} />
            </div>

            {overlayErrors.length > 0 && <div className="col-span-2 text-sm text-red-600">{overlayErrors.join(" • ")}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

