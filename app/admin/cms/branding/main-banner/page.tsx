"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { MainBannerConfig, defaultMainBannerConfig, normalizeMainBannerConfig, validateMainBannerConfig } from "@/lib/branding"
import MainBannerEditor from "@/components/admin/branding/main-banner-editor"
import MainBannerPreview from "@/components/admin/branding/main-banner-preview"

type SaveState = "idle" | "saving" | "saved" | "error"

export default function AdminMainBannerPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<MainBannerConfig>(defaultMainBannerConfig)
  const [published, setPublished] = useState<MainBannerConfig | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [dirty, setDirty] = useState(false)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null)
  const didLoad = useRef(false)
  const saveTimer = useRef<number | null>(null)

  const normalizedDraft = useMemo(() => normalizeMainBannerConfig(draft), [draft])
  const draftErrors = useMemo(() => validateMainBannerConfig(normalizedDraft), [normalizedDraft])
  const draftErrorsForAutosave = useMemo(() => draftErrors.filter((e) => e !== "Banner image is required"), [draftErrors])
  const canPublish = draftErrors.length === 0

  const diffSummary = useMemo(() => {
    if (!published) return ["No previous published banner"]
    const items: string[] = []
    if (published.imageUrl !== normalizedDraft.imageUrl) items.push("Image")
    if (published.heights.mobile !== normalizedDraft.heights.mobile) items.push("Mobile height")
    if (published.heights.tablet !== normalizedDraft.heights.tablet) items.push("Tablet height")
    if (published.heights.desktop !== normalizedDraft.heights.desktop) items.push("Desktop height")
    if (published.objectPosition !== normalizedDraft.objectPosition) items.push("Focal point")
    if (published.overlay.enabled !== normalizedDraft.overlay.enabled) items.push("Overlay enabled")
    if (published.overlay.enabled && normalizedDraft.overlay.enabled) {
      if (published.overlay.position !== normalizedDraft.overlay.position) items.push("Overlay position")
      if (published.overlay.headline !== normalizedDraft.overlay.headline) items.push("Overlay headline")
      if (published.overlay.subheadline !== normalizedDraft.overlay.subheadline) items.push("Overlay subheadline")
      if (published.overlay.ctaLabel !== normalizedDraft.overlay.ctaLabel) items.push("CTA label")
      if (published.overlay.ctaUrl !== normalizedDraft.overlay.ctaUrl) items.push("CTA URL")
      if (published.overlay.bgStyle !== normalizedDraft.overlay.bgStyle) items.push("Overlay background")
      if (published.overlay.bgOpacity !== normalizedDraft.overlay.bgOpacity) items.push("Overlay opacity")
      if (published.overlay.textColor !== normalizedDraft.overlay.textColor) items.push("Overlay text color")
    }
    return items.length ? items : ["No changes"]
  }, [published, normalizedDraft])

  async function authHeaders() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error("Not authenticated")
    return { Authorization: `Bearer ${token}` }
  }

  async function load() {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/admin/branding/main-banner", { headers })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setDraft(json.draft || defaultMainBannerConfig)
      setPublished(json.published || null)
      setDraftUpdatedAt(json.meta?.draftUpdatedAt || null)
      setPublishedAt(json.meta?.publishedAt || null)
      setPublishedVersion(json.meta?.publishedVersion || null)
      setDirty(false)
      setSaveState("idle")
      didLoad.current = true
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function saveDraft(next: MainBannerConfig) {
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/admin/branding/main-banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ draft: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to save")
      setDraft(json.draft || next)
      setDraftUpdatedAt(json.updatedAt || null)
      setDirty(false)
      setSaveState("saved")
    } catch (e: any) {
      setSaveState("error")
      toast({ title: "Autosave failed", description: e.message, variant: "destructive" })
    }
  }

  async function publish() {
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/admin/branding/main-banner/publish", { method: "POST", headers })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json.details && json.details.join("\n")) || json.error || "Failed to publish")
      setPublished(json.published)
      setPublishedAt(json.publishedAt || null)
      setPublishedVersion(json.version || null)
      setDirty(false)
      setSaveState("idle")
      toast({ title: "Published" })
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" })
    }
  }

  async function revert() {
    try {
      const headers = await authHeaders()
      const res = await fetch("/api/admin/branding/main-banner/revert", { method: "POST", headers })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to revert")
      setDraft(json.draft || defaultMainBannerConfig)
      setDraftUpdatedAt(json.updatedAt || null)
      setDirty(false)
      setSaveState("idle")
      toast({ title: "Reverted to last published" })
    } catch (e: any) {
      toast({ title: "Revert failed", description: e.message, variant: "destructive" })
    }
  }

  async function upload(file: File) {
    try {
      const headers = await authHeaders()
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/branding/assets/upload", { method: "POST", headers, body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Upload failed")
      setDraft((d) => ({ ...d, imageUrl: json.url }))
      setDirty(true)
      toast({ title: "Uploaded" })
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" })
    }
  }

  useEffect(() => {
    load()
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!didLoad.current) return
    if (!dirty) return
    if (draftErrorsForAutosave.length) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSaveState("saving")
    saveTimer.current = window.setTimeout(() => {
      saveDraft(normalizedDraft)
    }, 300)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [dirty, normalizedDraft, draftErrorsForAutosave])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid lg:grid-cols-[520px_1fr] gap-6">
        <MainBannerEditor
          loading={loading}
          draft={draft}
          normalizedDraft={normalizedDraft}
          dirty={dirty}
          saveState={saveState}
          canPublish={canPublish}
          draftErrors={draftErrors}
          diffSummary={diffSummary}
          draftUpdatedAt={draftUpdatedAt}
          publishedAt={publishedAt}
          publishedVersion={publishedVersion}
          onChangeDraft={(next: MainBannerConfig) => {
            setDraft(next)
            setDirty(true)
          }}
          onUpload={upload}
          onPublish={publish}
          onRevert={revert}
        />
        <MainBannerPreview loading={loading} draft={normalizedDraft} canPublish={canPublish} errors={draftErrors} />
      </div>
    </div>
  )
}
