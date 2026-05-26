"use client"

import { useRef } from "react"
import { useLanguage } from "@/lib/language-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UploadCloud, X } from "lucide-react"

export type UploadedFile = {
  id: string
  name: string
  size: number
  status: "uploading" | "done" | "error"
  progress: number
  storagePath?: string
  publicUrl?: string
  orderFileId?: string
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return ""
  const units = ["B", "KB", "MB", "GB"]
  let n = bytes
  let idx = 0
  while (n >= 1024 && idx < units.length - 1) {
    n /= 1024
    idx++
  }
  return `${n.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

function generateLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function FileUploadZone({
  sessionId,
  files,
  onChange,
}: {
  sessionId: string
  files: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
}) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const MAX_FILES = 10
  const MAX_SIZE = 50 * 1024 * 1024

  const accept =
    "application/pdf,image/png,image/jpeg,image/svg+xml,.ai,.eps,.psd"

  const addFiles = async (incoming: FileList | File[]) => {
    const incomingList = Array.from(incoming)
    const availableSlots = Math.max(0, MAX_FILES - files.length)
    const toAdd = incomingList.slice(0, availableSlots)

    if (incomingList.length > availableSlots) {
      toast({ title: t("product.upload_too_many") })
    }

    const next = [...files]
    for (const f of toAdd) {
      if (f.size > MAX_SIZE) {
        toast({ title: t("product.upload_too_large").replace("{max}", "50MB") })
        continue
      }

      const localId = generateLocalId()
      next.push({ id: localId, name: f.name, size: f.size, status: "uploading", progress: 15 })
      onChange([...next])

      try {
        const form = new FormData()
        form.append("file", f)
        form.append("file_type", "design")
        form.append("session_id", sessionId)

        const res = await fetch("/api/order-files/upload", { method: "POST", body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error || "Upload failed")
        }
        const data = await res.json()
        const orderFile = data?.orderFile || null

        const updated = next.map((x) =>
          x.id === localId
            ? {
                ...x,
                status: "done" as const,
                progress: 100,
                storagePath: orderFile?.path || undefined,
                publicUrl: orderFile?.publicUrl || undefined,
                orderFileId: orderFile?.id || undefined,
              }
            : x,
        )
        onChange(updated)
      } catch (e: any) {
        const updated = next.map((x) => (x.id === localId ? { ...x, status: "error" as const, progress: 0 } : x))
        onChange(updated)
        toast({ title: t("common.error"), description: e?.message || t("product.upload_failed"), variant: "destructive" })
      }
    }
  }

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id))
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{t("product.upload_label")}</p>
        <p className="text-sm text-gray-600">{t("product.upload_hint")}</p>
      </div>

      <div
        className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 hover:bg-gray-100"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UploadCloud className="h-5 w-5 text-gray-500" />
            <p className="text-sm text-gray-700">{t("product.upload_drop")}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            {t("product.upload_button")}
          </Button>
        </div>

        <p className="text-xs text-gray-500">{t("product.upload_constraints")}</p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {files.length > 0 ? (
        <div className="space-y-3 pt-2">
          {files.map((f) => (
            <div key={f.id} className="rounded-md border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(f.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(f.id)}
                  aria-label={t("product.remove_file")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {f.status === "uploading" || f.status === "done" ? <Progress value={f.progress} className="mt-2 h-2" /> : null}
              {f.status === "error" ? <p className="mt-2 text-xs text-red-600">{t("product.upload_failed")}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
