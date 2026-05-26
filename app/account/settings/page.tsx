"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

export default function AccountSettingsPage() {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [country, setCountry] = useState("El Salvador")

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch("/api/user/address", { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok && json.address) {
        setPhone(json.phone || "")
        setAddress(json.address.address || "")
        setCity(json.address.city || "")
        setState(json.address.state || "")
        setZipCode(json.address.zipCode || "")
        setCountry(json.address.country || "El Salvador")
      }
    })()
  }, [])

  async function onSave() {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error("Not authenticated")
      const payload = { phone, address: { address, city, state, zipCode, country } }
      const res = await fetch("/api/user/address", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Save failed")
      toast({ title: "Saved", description: "Account address updated." })
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      <Card>
        <CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+503 5555 5555" />
          </div>
          <div>
            <Label>Street Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Siempre Viva 742" />
          </div>
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Salvador" />
          </div>
          <div>
            <Label>State/Department</Label>
            <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="San Salvador" />
          </div>
          <div>
            <Label>ZIP/Postal Code</Label>
            <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="1101" />
          </div>
          <div>
            <Label>Country</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="El Salvador" />
          </div>
          <div className="md:col-span-2">
            <Button onClick={onSave} disabled={saving}>Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

