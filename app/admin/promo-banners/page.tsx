"use client"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

export default function PromoBannersAdminPage() {
  const { toast } = useToast()
  const [banners, setBanners] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    coupon_id: "",
    headline: "",
    supporting_text: "",
    cta_label: "",
    cta_url: "",
    bg_type: "color",
    bg_value: "linear-gradient(90deg,#10b981,#059669)",
    text_color: "#ffffff",
    status: "disabled",
    position: "sticky",
    priority: 0,
  })

  const gradientPreview = useMemo(() => form.bg_type === "image" ? undefined : form.bg_value, [form.bg_type, form.bg_value])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const [b, c] = await Promise.all([
        fetch('/api/admin/promo-banners', { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(r => r.json()),
        fetch('/api/admin/coupons', { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(r => r.json())
      ])
      setBanners(b.items || [])
      setCoupons((c.items || []).filter((x: any) => x.status === 'enabled'))
    } catch (e: any) {
      toast({ title: 'Load failed', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function onCreate() {
    setSaving(true)
    try {
      if (!form.coupon_id || !form.headline) throw new Error('Coupon and headline are required')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/admin/promo-banners', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(form) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Create failed')
      setForm((f: any) => ({ ...f, headline: '', supporting_text: '', cta_label: '', cta_url: '', status: 'disabled', priority: 0 }))
      await loadAll()
      toast({ title: 'Banner created' })
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(banner: any) {
    const next = banner.status === 'enabled' ? 'disabled' : 'enabled'
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`/api/admin/promo-banners/${banner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ status: next }) })
    if (res.ok) {
      setBanners(banners.map((b) => (b.id === banner.id ? { ...b, status: next } : b)))
    } else {
      const json = await res.json().catch(() => ({}))
      toast({ title: 'Update failed', description: json.error || 'Failed to update', variant: 'destructive' })
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Promo Banners</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create Banner</CardTitle>
          <CardDescription>Link to an active coupon and set appearance</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Coupon</Label>
            <Select value={form.coupon_id} onValueChange={(v) => setForm((f: any) => ({ ...f, coupon_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select coupon" />
              </SelectTrigger>
              <SelectContent>
                {coupons.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Headline</Label>
            <Input value={form.headline} onChange={(e) => setForm((f: any) => ({ ...f, headline: e.target.value }))} placeholder="Free shipping on orders over $50! ✨" />
          </div>
          <div className="md:col-span-2">
            <Label>Supporting Text</Label>
            <Textarea value={form.supporting_text} onChange={(e) => setForm((f: any) => ({ ...f, supporting_text: e.target.value }))} placeholder="Valid this week only." />
          </div>
          <div>
            <Label>CTA Label</Label>
            <Input value={form.cta_label} onChange={(e) => setForm((f: any) => ({ ...f, cta_label: e.target.value }))} placeholder="Shop Now" />
          </div>
          <div>
            <Label>CTA URL</Label>
            <Input value={form.cta_url} onChange={(e) => setForm((f: any) => ({ ...f, cta_url: e.target.value }))} placeholder="/products" />
          </div>
          <div>
            <Label>Background</Label>
            <Select value={form.bg_type} onValueChange={(v) => setForm((f: any) => ({ ...f, bg_type: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Background type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="color">Color/Gradient</SelectItem>
                <SelectItem value="image">Image (url)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>{form.bg_type === 'image' ? 'Image URL' : 'CSS Gradient/Color'}</Label>
            <Input value={form.bg_value} onChange={(e) => setForm((f: any) => ({ ...f, bg_value: e.target.value }))} placeholder="linear-gradient(90deg,#10b981,#059669)" />
          </div>
          <div>
            <Label>Text Color</Label>
            <Input type="color" value={form.text_color} onChange={(e) => setForm((f: any) => ({ ...f, text_color: e.target.value }))} />
          </div>
          <div>
            <Label>Priority</Label>
            <Input type="number" value={form.priority} onChange={(e) => setForm((f: any) => ({ ...f, priority: Number(e.target.value || 0) }))} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.status === 'enabled'} onCheckedChange={(v) => setForm((f: any) => ({ ...f, status: v ? 'enabled' : 'disabled' }))} />
            <span>Enabled</span>
          </div>
          <div className="md:col-span-3">
            <div className="rounded border" style={{ background: gradientPreview || undefined }}>
              <div className="px-4 py-3 text-white text-sm flex items-center gap-3" style={{ color: form.text_color }}>
                <span>🛒</span>
                <span className="font-medium">{form.headline || 'Preview headline'}</span>
                {form.cta_label && <span className="underline">{form.cta_label}</span>}
              </div>
            </div>
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={onCreate} disabled={saving || !form.headline || !form.coupon_id}>Create</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Banners</CardTitle>
          <CardDescription>Enable/disable and adjust priority</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coupon</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && banners.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.coupon?.code || '—'}</TableCell>
                  <TableCell className="max-w-xl truncate">{b.headline}</TableCell>
                  <TableCell>{b.status}</TableCell>
                  <TableCell>{b.priority}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(b)}>
                      {b.status === 'enabled' ? 'Disable' : 'Enable'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

