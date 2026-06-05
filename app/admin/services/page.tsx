"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, MoreHorizontal, Download, Package } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/language-context"
import EditServiceModal, { type ServiceRow } from "./_components/EditServiceModal"

export default function ServicesManagement() {
  const { t } = useLanguage()
  const { toast } = useToast()

  const [services, setServices] = useState<(ServiceRow & { created_at: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceRow | null>(null)
  const [primaryImages, setPrimaryImages] = useState<Record<string, string>>({})
  const importFileRef = useRef<HTMLInputElement>(null)

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ""
  }, [])

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: false })
      if (error) throw error
      const rows = (data || []) as any[]
      setServices(rows)

      const ids = rows.map((r) => r.id).filter(Boolean)
      if (ids.length > 0) {
        const { data: imagesData } = await supabase
          .from("service_images")
          .select("service_id, url, sort_order")
          .in("service_id", ids)
          .order("sort_order", { ascending: true })

        const map: Record<string, string> = {}
        for (const img of imagesData || []) {
          const sid = String((img as any).service_id)
          if (!map[sid]) map[sid] = String((img as any).url || "")
        }
        setPrimaryImages(map)
      } else {
        setPrimaryImages({})
      }
    } catch (error) {
      console.error("Error loading services:", error)
      toast({ title: t("common.error"), description: "Failed to load services", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  const handleEdit = (svc: ServiceRow) => {
    setEditingService(svc)
    setIsDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingService(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingService(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return
    try {
      const token = await getToken()
      if (!token) {
        toast({ title: t("common.error"), description: t("common.unauthorized"), variant: "destructive" })
        return
      }

      const res = await fetch(`/api/admin/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: t("common.error"), description: err?.error || "Failed to delete service", variant: "destructive" })
        return
      }
      toast({ title: t("common.success"), description: "Service deleted" })
      loadServices().catch(() => {})
    } catch (error) {
      console.error("Error deleting service:", error)
      toast({ title: t("common.error"), description: "Failed to delete service", variant: "destructive" })
    }
  }

  const filteredServices = services.filter((s) => {
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-600">Manage service entries shown across the Services pages.</p>
        </div>
        <div className="flex space-x-2">
          <Button className="bg-[#8B0000] hover:bg-[#6B0000]" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add Service
          </Button>
          <EditServiceModal
            open={isDialogOpen}
            onOpenChange={(open) => (open ? setIsDialogOpen(true) : handleDialogClose())}
            service={editingService}
            onSaved={() => loadServices().catch(() => {})}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input placeholder="Search services" className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" /> Export
                  <MoreHorizontal className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => {
                  const csv = ["name,category,price,is_active,is_featured,slug"].concat(
                    services.map((s) => `${JSON.stringify(s.name)},${JSON.stringify(s.category || "")},${s.price},${s.is_active},${s.is_featured},${JSON.stringify(s.slug || "")}`)
                  ).join("\n")
                  const blob = new Blob([csv], { type: "text/csv" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `services_${new Date().toISOString().slice(0,10)}.csv`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                }}>Export All</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{`Services (${filteredServices.length})`}</CardTitle>
          <CardDescription>Catalog services displayed to customers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((svc) => (
                <TableRow key={svc.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">
                        {primaryImages[svc.id] || svc.image ? (
                          <img src={primaryImages[svc.id] || svc.image || "/placeholder.svg"} alt={svc.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{svc.name}</p>
                        {svc.is_featured && (
                          <Badge variant="secondary" className="text-xs">Featured</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{svc.category || "N/A"}</TableCell>
                  <TableCell>${svc.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={svc.is_active ? "default" : "secondary"}>{svc.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>{new Date(svc.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(svc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(svc.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredServices.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No services found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
