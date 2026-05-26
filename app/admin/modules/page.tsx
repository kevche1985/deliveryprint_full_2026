"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

type VisibilityMap = Record<string, boolean>

const defaultAdminVisibility: VisibilityMap = {
  dashboard: true,
  orders: true,
  products: true,
  services: true,
  coupons: true,
  users: true,
  quotes: true,
  transactions: true,
  disputes: true,
  emailSettings: true,
}

const defaultWebVisibility: VisibilityMap = {
  products: true,
  services: true,
  services_digital_printing: true,
  services_large_format: true,
  services_event_stands: true,
  services_illuminated_signs: true,
  aiStudio: true,
  supplierPortal: true,
}

export default function ModulesVisibilityPage() {
  const { toast } = useToast()
  const [adminVis, setAdminVis] = useState<VisibilityMap>(defaultAdminVisibility)
  const [webVis, setWebVis] = useState<VisibilityMap>(defaultWebVisibility)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token || ""
        const res = await fetch("/api/admin/modules", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) throw new Error(await res.text())
        const json = await res.json()
        setAdminVis({ ...defaultAdminVisibility, ...(json.admin_modules_visibility || {}) })
        setWebVis({ ...defaultWebVisibility, ...(json.web_modules_visibility || {}) })
      } catch (e: any) {
        toast({ title: "Failed to load", description: e.message, variant: "destructive" })
      }
    }
    load()
  }, [toast])

  const handleToggle = (map: "admin" | "web", key: string, val: boolean) => {
    if (map === "admin") setAdminVis((prev) => ({ ...prev, [key]: val }))
    else setWebVis((prev) => ({ ...prev, [key]: val }))
  }

  const save = async () => {
    try {
      setSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ""
      const res = await fetch("/api/admin/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ admin_modules_visibility: adminVis, web_modules_visibility: webVis }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ title: "Saved", description: "Module visibility updated" })
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const renderTable = (title: string, map: VisibilityMap, onToggle: (k: string, v: boolean) => void) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Toggle visibility of modules</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Visible</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.keys(map).map((key) => (
              <TableRow key={key}>
                <TableCell className="font-medium">{key}</TableCell>
                <TableCell className="text-right">
                  <Switch checked={!!map[key]} onCheckedChange={(v) => onToggle(key, !!v)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Modules Visibility</h1>
          <p className="text-gray-600">Manage visibility of Admin and Web modules</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#8B0000] hover:bg-[#6B0000]">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {renderTable("Admin Modules", adminVis, (k, v) => handleToggle("admin", k, v))}
      {renderTable("Web Modules", webVis, (k, v) => handleToggle("web", k, v))}
    </div>
  )
}

