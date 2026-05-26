"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function AdminCustomizationPage() {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [brandName, setBrandName] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primary, setPrimary] = useState("#8B0000")
  const [accent, setAccent] = useState("#6B0000")
  const [background, setBackground] = useState("#ffffff")
  const [text, setText] = useState("#111827")
  const [link, setLink] = useState("#8B0000")

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/admin/customization")
        const json = await res.json()
        if (json.brand_name) setBrandName(json.brand_name)
        if (json.logo_url) setLogoUrl(json.logo_url)
        if (json.colors) {
          setPrimary(json.colors.primary || "#8B0000")
          setAccent(json.colors.accent || "#6B0000")
          setBackground(json.colors.background || "#ffffff")
          setText(json.colors.text || "#111827")
          setLink(json.colors.link || "#8B0000")
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function uploadLogo(f: File) {
    const fd = new FormData()
    fd.append("file", f)
    const res = await fetch("/api/admin/customization/upload-logo", { method: "POST", body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "Upload failed")
    setLogoUrl(json.url)
    toast({ title: "Logo uploaded", description: "Your logo was uploaded successfully." })
  }

  async function onSave() {
    setSaving(true)
    try {
      const colors = { primary: primary || "#8B0000", accent: accent || "#6B0000", background: background || "#ffffff", text: text || "#111827", link: link || primary || "#8B0000" }
      const body = { brand_name: brandName, ...(logoUrl ? { logo_url: logoUrl } : {}), colors }
      const res = await fetch("/api/admin/customization", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || "Save failed")
      toast({ title: "Saved", description: "Customization updated." })
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || String(e), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6">Loading...</p>

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Web Customizer</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Brand</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your Company" />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 object-contain" />}
              <Input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => {
                const f = e.target.files?.[0] || null
                if (f) await uploadLogo(f)
              }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>Primary</Label><Input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} /></div>
            <div><Label>Accent</Label><Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} /></div>
            <div><Label>Background</Label><Input type="color" value={background} onChange={(e) => setBackground(e.target.value)} /></div>
            <div><Label>Text</Label><Input type="color" value={text} onChange={(e) => setText(e.target.value)} /></div>
            <div><Label>Link</Label><Input type="color" value={link} onChange={(e) => setLink(e.target.value)} /></div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="p-6 rounded" style={{ background, color: text }}>
            <div className="flex items-center space-x-3">
              {logoUrl && <img src={logoUrl} className="h-10" />}
              <span className="text-xl font-semibold" style={{ color: text }}>{brandName || "Brand Name"}</span>
            </div>
            <div className="mt-4">
              <button className="px-4 py-2 rounded text-white" style={{ background: primary }}>Primary Button</button>
              <button className="ml-2 px-4 py-2 rounded text-white" style={{ background: accent }}>Accent Button</button>
            </div>
            <p className="mt-4"><a href="#" style={{ color: link }}>Sample link</a> and sample paragraph demonstrating text contrast.</p>
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-3"><Button disabled={saving} onClick={onSave}>Save</Button></div>
    </div>
  )
}

