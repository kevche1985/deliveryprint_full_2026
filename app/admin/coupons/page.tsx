"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

type Coupon = any

export default function CouponsAdminPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Coupon[]>([])
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState("order_percent")
  const [amount, setAmount] = useState("20")
  const [enabled, setEnabled] = useState(true)
  const [freeShipping, setFreeShipping] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch("/api/admin/coupons", { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setItems(json.items || [])
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function onCreate() {
    setSaving(true)
    try {
      if (!code.trim()) {
        throw new Error("Code is required")
      }
      const body = {
        code,
        discount_type: discountType,
        amount: Number(amount || 0),
        status: enabled ? "enabled" : "disabled",
        free_shipping: freeShipping,
      }
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
      const text = await res.text()
      let json: any = {}
      try { json = text ? JSON.parse(text) : {} } catch {}
      if (!res.ok) throw new Error(json.error || text || "Create failed")
      setCode("")
      setAmount("20")
      setFreeShipping(false)
      setEnabled(true)
      await load()
      toast({ title: "Coupon created" })
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Coupons</h1>
      <Card>
        <CardHeader><CardTitle>Create Coupon</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 items-end gap-4">
          <div className="md:col-span-2">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="spring20" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={discountType} onValueChange={setDiscountType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="order_fixed">Order Fixed</SelectItem>
                <SelectItem value="order_percent">Order Percent</SelectItem>
                <SelectItem value="product_fixed">Product Fixed</SelectItem>
                <SelectItem value="product_percent">Product Percent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} /><span>Enabled</span></div>
            <div className="flex items-center gap-2"><Switch checked={freeShipping} onCheckedChange={setFreeShipping} /><span>Free Shipping</span></div>
            <Button className="shrink-0" onClick={onCreate} disabled={saving || !code.trim()}>Create</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Coupons</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Free Ship</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && items.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.code}</TableCell>
                  <TableCell>{c.discount_type}</TableCell>
                  <TableCell>{c.amount}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>{c.free_shipping ? "Yes" : "No"}</TableCell>
                  <TableCell>{c.start_at ? new Date(c.start_at).toLocaleString() : ""}</TableCell>
                  <TableCell>{c.end_at ? new Date(c.end_at).toLocaleString() : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
