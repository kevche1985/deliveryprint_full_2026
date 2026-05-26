"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"
import { GripVertical, Play, UploadCloud, X } from "lucide-react"

export type AdminMediaItem = {
  id: string
  storagePath: string
  url: string
  type: "image" | "video"
  altText: string
  sortOrder: number
  status: "ready" | "uploading" | "error"
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export default function MediaManager({
  items,
  onChange,
  onRemoveExisting,
  disabled,
}: {
  items: AdminMediaItem[]
  onChange: (items: AdminMediaItem[]) => void
  onRemoveExisting: (item: AdminMediaItem) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const sorted = useMemo(() => items.slice().sort((a, b) => a.sortOrder - b.sortOrder), [items])

  const MAX_FILES = 10
  const MAX_SIZE = 50 * 1024 * 1024
  const accept = "image/*,video/mp4,video/webm"

  const reindex = (next: AdminMediaItem[]) => next.map((x, idx) => ({ ...x, sortOrder: idx }))

  const addFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList)
    const availableSlots = Math.max(0, MAX_FILES - items.length)
    const toAdd = incoming.slice(0, availableSlots)

    const next = items.slice()
    for (const file of toAdd) {
      if (file.size > MAX_SIZE) continue
      const id = generateId()
      const storagePath = `product_media/${Date.now()}-${id}-${safeName(file.name)}`
      const type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image"
      const placeholder: AdminMediaItem = {
        id,
        storagePath,
        url: "",
        type,
        altText: "",
        sortOrder: next.length,
        status: "uploading",
      }
      next.push(placeholder)
      onChange(reindex(next))

      try {
        const { error: upErr } = await supabase.storage.from("product-media").upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from("product-media").getPublicUrl(storagePath)
        const publicUrl = pub?.publicUrl || ""
        const updated = next.map((x) => (x.id === id ? { ...x, url: publicUrl, status: "ready" as const } : x))
        onChange(reindex(updated))
      } catch {
        const updated = next.map((x) => (x.id === id ? { ...x, status: "error" as const } : x))
        onChange(reindex(updated))
      }
    }
  }

  const handleRemove = (id: string) => {
    const item = items.find((x) => x.id === id)
    if (!item) return
    onRemoveExisting(item)
    onChange(reindex(items.filter((x) => x.id !== id)))
  }

  const move = (dragId: string, overId: string) => {
    if (dragId === overId) return
    const current = sorted.slice()
    const from = current.findIndex((x) => x.id === dragId)
    const to = current.findIndex((x) => x.id === overId)
    if (from === -1 || to === -1) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    onChange(reindex(current))
  }

  return (
    <div className="space-y-3">
      <div
        className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 hover:bg-gray-100"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (disabled) return
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
        onClick={() => (disabled ? null : inputRef.current?.click())}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UploadCloud className="h-5 w-5 text-gray-500" />
            <p className="text-sm text-gray-700">Drag & drop or click to upload</p>
          </div>
          <Button type="button" variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
            Upload
          </Button>
        </div>
        <p className="text-xs text-gray-500">Up to {MAX_FILES} files · Max 50MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {sorted.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 bg-white p-3"
              draggable={!disabled}
              onDragStart={() => setDraggingId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => (draggingId ? move(draggingId, item.id) : null)}
              onDragEnd={() => setDraggingId(null)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-gray-400">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div className="relative h-20 w-20 overflow-hidden rounded-md bg-gray-100">
                    {item.type === "image" && item.url ? (
                      <img src={item.url} alt={item.altText || "Media"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        {item.type === "video" ? <Play className="h-6 w-6 text-gray-600" /> : null}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {idx === 0 ? <Badge variant="secondary">Main</Badge> : null}
                      <Badge variant="outline">{item.type}</Badge>
                    </div>

                    {item.type === "image" ? (
                      <Input
                        value={item.altText}
                        onChange={(e) => onChange(items.map((x) => (x.id === item.id ? { ...x, altText: e.target.value } : x)))}
                        placeholder="Alt text"
                        disabled={disabled}
                        className="h-8"
                      />
                    ) : null}
                  </div>
                </div>

                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(item.id)} disabled={disabled}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {item.status === "uploading" ? <Progress value={35} className="mt-3 h-2" /> : null}
              {item.status === "error" ? <p className="mt-3 text-xs text-red-600">Upload failed</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

