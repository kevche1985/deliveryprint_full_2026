"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import type { MainBannerConfig } from "@/lib/branding"
import MainBannerFocalCard from "@/components/admin/branding/main-banner-focal-card"
import MainBannerOverlayCard from "@/components/admin/branding/main-banner-overlay-card"

type SaveState = "idle" | "saving" | "saved" | "error"

type Props = {
  loading: boolean
  draft: MainBannerConfig
  normalizedDraft: MainBannerConfig
  dirty: boolean
  saveState: SaveState
  canPublish: boolean
  draftErrors: string[]
  diffSummary: string[]
  draftUpdatedAt: string | null
  publishedAt: string | null
  publishedVersion: number | null
  onChangeDraft: (next: MainBannerConfig) => void
  onUpload: (file: File) => void
  onPublish: () => void
  onRevert: () => void
}

export default function MainBannerEditor(props: Props) {
  const statusLabel = props.loading
    ? "Loading"
    : props.dirty
      ? "Unsaved"
      : props.saveState === "saving"
        ? "Saving"
        : props.saveState === "saved"
          ? "Saved"
          : "Ready"

  const statusVariant = props.dirty ? "destructive" : props.saveState === "saving" ? "secondary" : "outline"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Branding</h1>
          <p className="text-sm text-muted-foreground">Main Banner</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant as any}>{statusLabel}</Badge>
          <Button variant="outline" onClick={props.onRevert} disabled={props.loading || props.saveState === "saving"}>
            Revert to last published
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={props.loading || !props.canPublish || props.saveState === "saving"}>Publish</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish banner changes?</AlertDialogTitle>
                <AlertDialogDescription>This will update the live storefront immediately. Changed: {props.diffSummary.join(", ")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={props.onPublish}>Publish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Banner Image</CardTitle>
          <CardDescription>Upload JPG/PNG/WEBP/SVG, max 5MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bannerFile">Upload</Label>
            <Input
              id="bannerFile"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) props.onUpload(f)
                e.currentTarget.value = ""
              }}
            />
          </div>
          <div className="rounded-md border overflow-hidden bg-muted">
            {props.normalizedDraft.imageUrl ? (
              <img src={props.normalizedDraft.imageUrl} alt="Banner" className="w-full h-40 object-cover" style={{ objectPosition: props.normalizedDraft.objectPosition }} />
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No image</div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input
              value={props.draft.imageUrl}
              onChange={(e) => props.onChangeDraft({ ...props.draft, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          {props.draftErrors.includes("Banner image is required") && <div className="text-sm text-red-600">Banner image is required to publish.</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Responsive Heights</CardTitle>
          <CardDescription>100–1200px per breakpoint</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {(["mobile", "tablet", "desktop"] as const).map((bp) => (
            <div key={bp}>
              <Label className="capitalize">{bp}</Label>
              <Input
                type="number"
                value={props.draft.heights[bp]}
                onChange={(e) => {
                  const v = Number(e.target.value || 0)
                  props.onChangeDraft({ ...props.draft, heights: { ...props.draft.heights, [bp]: v } })
                }}
              />
            </div>
          ))}
          {props.draftErrors.some((e) => e.includes("height")) && <div className="col-span-3 text-sm text-red-600">Fix invalid heights before publishing.</div>}
        </CardContent>
      </Card>

      <MainBannerFocalCard draft={props.draft} normalizedDraft={props.normalizedDraft} onChangeDraft={props.onChangeDraft} />

      <MainBannerOverlayCard draft={props.draft} draftErrors={props.draftErrors} onChangeDraft={props.onChangeDraft} />

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>Draft autosaves; publish to apply to storefront</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>Draft updated: {props.draftUpdatedAt ? new Date(props.draftUpdatedAt).toLocaleString() : "—"}</div>
          <div>Published: {props.publishedAt ? new Date(props.publishedAt).toLocaleString() : "—"}</div>
          <div>Version: {props.publishedVersion ?? "—"}</div>
        </CardContent>
      </Card>
    </div>
  )
}
