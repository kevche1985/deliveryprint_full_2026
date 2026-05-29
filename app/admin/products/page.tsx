"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Edit, Trash2, Search, Package, Upload, Download, MoreHorizontal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/lib/language-context"
import MediaManager, { type AdminMediaItem } from "./_components/MediaManager"
import VariantGroupBuilder, { type AdminVariantGroup } from "./_components/VariantGroupBuilder"
import SpecificationsEditor, { type SpecRow } from "./_components/SpecificationsEditor"

type Product = {
  id: string
  name: string
  short_description: string | null
  description: string | null
  price: number
  category: string | null
  image: string | null
  is_active: boolean
  is_featured: boolean
  is_customizable: boolean
  accepts_uploads: boolean | null
  technique: string | null
  has_archive_guide: boolean | null
  specifications: any | null
  shipping_info: string | null
  wholesale_tiers: any | null
  rating: number | null
  review_count: number | null
  created_at: string
}

type Category = {
  id: string
  name: string
  description: string | null
  slug: string | null
  image_url: string | null
  is_active: boolean
  parent_id: string | null
  created_at?: string
}

export default function ProductManagement() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    short_description: "",
    description: "",
    price: "",
    category: "",
    image: "",
    technique: "",
    has_archive_guide: false,
    is_active: true,
    is_featured: false,
    accepts_uploads: false,
    is_customizable: false,
    shipping_info: "",
    wholesale_tiers: "",
    rating: "",
    review_count: "",
  })
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const importFileRef = useRef<HTMLInputElement>(null)
  const [mediaItems, setMediaItems] = useState<AdminMediaItem[]>([])
  const [originalMediaItems, setOriginalMediaItems] = useState<AdminMediaItem[]>([])
  const [removedMediaItems, setRemovedMediaItems] = useState<AdminMediaItem[]>([])
  const [variantGroups, setVariantGroups] = useState<AdminVariantGroup[]>([])
  const [originalVariantGroups, setOriginalVariantGroups] = useState<AdminVariantGroup[]>([])
  const [specifications, setSpecifications] = useState<SpecRow[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", is_active: true })

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error("Error loading products:", error)
      toast({
        title: t("common.error"),
        description: t("admin.products.toasts.errorLoadingProducts"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true })
      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error loading categories:", error)
      toast({ title: t("common.error"), description: t("admin.products.toasts.errorLoadingCategories"), variant: "destructive" })
    }
  }

  const normalizeSpecifications = (raw: any): SpecRow[] => {
    if (!Array.isArray(raw)) return []
    return raw
      .map((r) => {
        if (!r || typeof r !== "object") return null
        const key = typeof (r as any).key === "string" ? (r as any).key : ""
        const value = typeof (r as any).value === "string" ? (r as any).value : ""
        return { key, value }
      })
      .filter((x): x is SpecRow => !!x)
  }

  const loadProductMedia = async (productId: string) => {
    const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true })
    if (error) throw error
    const mapped: AdminMediaItem[] =
      (data || []).map((row: any) => {
        const { data: pub } = supabase.storage.from("product-media").getPublicUrl(row.storage_path)
        return {
          id: row.id,
          storagePath: row.storage_path,
          url: pub?.publicUrl || "",
          type: row.type,
          altText: row.alt_text || "",
          sortOrder: row.sort_order ?? 0,
          status: "ready",
        } as AdminMediaItem
      }) || []
    setMediaItems(mapped)
    setOriginalMediaItems(mapped)
    setRemovedMediaItems([])
  }

  const loadVariantGroupData = async (productId: string) => {
    const { data, error } = await supabase
      .from("product_variant_groups")
      .select("*, product_variant_options(*)")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true })
    if (error) throw error
    const mapped: AdminVariantGroup[] =
      (data || []).map((g: any, idx: number) => ({
        id: g.id,
        name: g.name,
        display: g.display,
        sortOrder: g.sort_order ?? idx,
        options: (g.product_variant_options || [])
          .slice()
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((o: any, oIdx: number) => ({
            id: o.id,
            label: o.label,
            priceModifier: Number(o.price_modifier ?? 0),
            isAvailable: o.is_available ?? true,
            sortOrder: o.sort_order ?? oIdx,
          })),
      })) || []
    setVariantGroups(mapped)
    setOriginalVariantGroups(mapped)
  }

  const handleRemoveMedia = async (item: AdminMediaItem) => {
    const isOriginal = originalMediaItems.some((x) => x.id === item.id)
    if (isOriginal) {
      setRemovedMediaItems((prev) => [...prev, item])
      return
    }
    try {
      await supabase.storage.from("product-media").remove([item.storagePath])
    } catch {}
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSaving) return
    setIsSaving(true)

    try {
      const cleanedSpecs = specifications
        .map((r) => ({ key: r.key.trim(), value: r.value.trim() }))
        .filter((r) => r.key && r.value)

      const hasAnyGroups = variantGroups.length > 0
      if (formData.is_active && hasAnyGroups) {
        const invalidGroup = variantGroups.find((g) => !g.name.trim() || g.options.filter((o) => o.label.trim()).length === 0)
        if (invalidGroup) {
          toast({ title: t("common.error"), description: t("admin.products.toasts.variantValidationFailed"), variant: "destructive" })
          return
        }
      }

      let wholesaleTiersJson: any = null
      const wholesaleRaw = formData.wholesale_tiers.trim()
      if (wholesaleRaw) {
        try {
          wholesaleTiersJson = JSON.parse(wholesaleRaw)
        } catch {
          toast({ title: t("common.error"), description: t("admin.products.toasts.invalidWholesaleJson"), variant: "destructive" })
          return
        }
      }

      const ratingNum = formData.rating.trim() ? Number(formData.rating) : null
      const reviewCountNum = formData.review_count.trim() ? Number(formData.review_count) : null

      const primaryImage =
        mediaItems
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .find((m) => m.type === "image" && m.status === "ready" && m.url)?.url ||
        formData.image.trim() ||
        null

      const productData: any = {
        name: formData.name,
        short_description: formData.short_description || null,
        description: formData.description || null,
        price: Number.parseFloat(formData.price),
        category: formData.category || null,
        image: primaryImage,
        technique: formData.technique || null,
        has_archive_guide: formData.has_archive_guide,
        accepts_uploads: formData.accepts_uploads,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        is_customizable: formData.is_customizable,
        specifications: cleanedSpecs.length > 0 ? cleanedSpecs : null,
        shipping_info: formData.shipping_info || null,
        wholesale_tiers: wholesaleTiersJson,
        rating: Number.isFinite(ratingNum) ? ratingNum : null,
        review_count: Number.isFinite(reviewCountNum) ? reviewCountNum : null,
      }

      const desiredMedia = mediaItems
        .filter((m) => m.status === "ready" && m.storagePath)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const desiredGroups = variantGroups.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      desiredGroups.forEach((g, idx) => {
        g.sortOrder = idx
        g.options = g.options
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o, oIdx) => ({ ...o, sortOrder: oIdx }))
      })

      let savedProductId = editingProduct?.id || null
      if (editingProduct) {
        const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id)
        if (error) throw error
        savedProductId = editingProduct.id
      } else {
        const { data, error } = await supabase.from("products").insert([productData]).select("id").single()
        if (error) throw error
        savedProductId = data?.id || null
      }

      if (!savedProductId) throw new Error("Missing product id")

      const keepMediaIds = new Set(desiredMedia.map((m) => m.id))
      const deleteMedia = originalMediaItems.filter((m) => !keepMediaIds.has(m.id)).concat(removedMediaItems)
      const deleteMediaIds = Array.from(new Set(deleteMedia.map((m) => m.id)))
      const deleteMediaPaths = Array.from(new Set(deleteMedia.map((m) => m.storagePath).filter(Boolean)))

      const upsertMediaRows = desiredMedia.map((m) => ({
        id: m.id,
        product_id: savedProductId,
        storage_path: m.storagePath,
        type: m.type,
        alt_text: m.type === "image" ? (m.altText || null) : null,
        sort_order: m.sortOrder,
      }))
      if (upsertMediaRows.length > 0) {
        const { error } = await supabase.from("product_media").upsert(upsertMediaRows, { onConflict: "id" })
        if (error) throw error
      }
      if (deleteMediaIds.length > 0) {
        await supabase.from("product_media").delete().in("id", deleteMediaIds)
      }
      if (deleteMediaPaths.length > 0) {
        await supabase.storage.from("product-media").remove(deleteMediaPaths)
      }

      const keepGroupIds = new Set(desiredGroups.map((g) => g.id))
      const originalGroupIds = originalVariantGroups.map((g) => g.id)
      const groupsToDelete = originalGroupIds.filter((id) => !keepGroupIds.has(id))
      if (groupsToDelete.length > 0) {
        await supabase.from("product_variant_groups").delete().in("id", groupsToDelete)
      }

      const upsertGroupRows = desiredGroups.map((g) => ({
        id: g.id,
        product_id: savedProductId,
        name: g.name || "",
        display: g.display,
        sort_order: g.sortOrder,
      }))
      if (upsertGroupRows.length > 0) {
        const { error } = await supabase.from("product_variant_groups").upsert(upsertGroupRows, { onConflict: "id" })
        if (error) throw error
      }

      const desiredOptionIds = new Set(desiredGroups.flatMap((g) => g.options.map((o) => o.id)))
      const originalOptionIds = originalVariantGroups.flatMap((g) => g.options.map((o) => o.id))
      const optionsToDelete = originalOptionIds.filter((id) => !desiredOptionIds.has(id))
      if (optionsToDelete.length > 0) {
        await supabase.from("product_variant_options").delete().in("id", optionsToDelete)
      }

      const upsertOptionRows = desiredGroups.flatMap((g) =>
        g.options.map((o) => ({
          id: o.id,
          group_id: g.id,
          label: o.label || "",
          price_modifier: o.priceModifier,
          is_available: o.isAvailable,
          sort_order: o.sortOrder,
        })),
      )
      if (upsertOptionRows.length > 0) {
        const { error } = await supabase.from("product_variant_options").upsert(upsertOptionRows, { onConflict: "id" })
        if (error) throw error
      }

      toast({
        title: t("common.success"),
        description: editingProduct ? t("admin.products.toasts.productUpdated") : t("admin.products.toasts.productCreated"),
      })
      handleDialogClose()
      loadProducts()
    } catch (error) {
      console.error("Error saving product:", error)
      toast({ title: t("common.error"), description: t("admin.products.toasts.saveProductFailed"), variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (product: Product) => {
    loadCategories()
    setEditingProduct(product)
    setFormData({
      name: product.name,
      short_description: product.short_description || "",
      description: product.description || "",
      price: product.price.toString(),
      category: product.category || "",
      image: product.image || "",
      technique: product.technique || "",
      has_archive_guide: product.has_archive_guide ?? false,
      is_active: product.is_active,
      is_featured: product.is_featured,
      accepts_uploads: product.accepts_uploads ?? false,
      is_customizable: product.is_customizable ?? false,
      shipping_info: product.shipping_info || "",
      wholesale_tiers: product.wholesale_tiers ? JSON.stringify(product.wholesale_tiers, null, 2) : "",
      rating: product.rating != null ? String(product.rating) : "",
      review_count: product.review_count != null ? String(product.review_count) : "",
    })
    setSpecifications(normalizeSpecifications(product.specifications))
    loadProductMedia(product.id).catch(() => {})
    loadVariantGroupData(product.id).catch(() => {})
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingProduct(null)
    setFormData({
      name: "",
      short_description: "",
      description: "",
      price: "",
      category: "",
      image: "",
      technique: "",
      has_archive_guide: false,
      is_active: true,
      is_featured: false,
      accepts_uploads: false,
      is_customizable: false,
      shipping_info: "",
      wholesale_tiers: "",
      rating: "",
      review_count: "",
    })
    setMediaItems([])
    setOriginalMediaItems([])
    setRemovedMediaItems([])
    setVariantGroups([])
    setOriginalVariantGroups([])
    setSpecifications([])
    setIsSaving(false)
  }

  const handleDelete = async (productId: string) => {
    if (!confirm(t("admin.products.toasts.deleteConfirm"))) return

    try {
      const { error } = await supabase.from("products").delete().eq("id", productId)

      if (error) throw error

      toast({
        title: t("common.success"),
        description: t("admin.products.toasts.productDeleted"),
      })
      loadProducts()
    } catch (error) {
      console.error("Error deleting product:", error)
      toast({
        title: t("common.error"),
        description: t("admin.products.toasts.deleteProductFailed"),
        variant: "destructive",
      })
    }
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProductIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(productId)
      } else {
        newSet.delete(productId)
      }
      return newSet
    })
  }

  const handleSelectAllProducts = (checked: boolean) => {
    if (checked) {
      const allProductIds = filteredProducts.map((p) => p.id)
      setSelectedProductIds(new Set(allProductIds))
    } else {
      setSelectedProductIds(new Set())
    }
  }

  const handleImport = async () => {
    if (!importFileRef.current?.files?.length) {
      toast({
        title: t("admin.products.toasts.noFileSelectedTitle"),
        description: t("admin.products.toasts.noFileSelectedDesc"),
        variant: "destructive",
      })
      return
    }

    const file = importFileRef.current.files[0]
    const formData = new FormData()
    formData.append("file", file)

    try {
      toast({
        title: t("admin.products.toasts.importingProductsTitle"),
        description: t("admin.products.toasts.importingProductsDesc"),
      })

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token || ""
      if (!token) throw new Error("Unauthorized")

      const response = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errMsg: string | undefined
        try {
          const errorData = await response.json()
          errMsg = errorData.error
        } catch (_) {
          // If response is not JSON, fallback to a localized message
        }
        throw new Error(errMsg || t("admin.products.toasts.importFailedDesc"))
      }

      const result = await response.json()
      toast({
        title: t("admin.products.toasts.importCompleteTitle"),
        description: t("admin.products.toasts.importCompleteDesc")
          .replace("{created}", String(result.created))
          .replace("{updated}", String(result.updated)),
      })
      setIsImportDialogOpen(false)
      loadProducts() // Reload products after import
    } catch (error: any) {
      console.error("Error during import:", error)
      toast({
        title: t("admin.products.toasts.importFailedTitle"),
        description: error.message || t("admin.products.toasts.importFailedDesc"),
        variant: "destructive",
      })
    }
  }

  const handleExport = async (exportType: "all" | "selected") => {
    try {
      toast({
        title: t("admin.products.toasts.exportingProductsTitle"),
        description: t("admin.products.toasts.exportingProductsDesc"),
      })

      let url = "/api/admin/products/export"
      if (exportType === "selected" && selectedProductIds.size > 0) {
        url += `?ids=${Array.from(selectedProductIds).join(",")}`
      } else if (exportType === "selected" && selectedProductIds.size === 0) {
        toast({
          title: t("admin.products.toasts.noProductsSelectedTitle"),
          description: t("admin.products.toasts.noProductsSelectedDesc"),
          variant: "destructive",
        })
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token || ""
      if (!token) throw new Error("Unauthorized")

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errMsg: string | undefined
        try {
          const errorData = await response.json()
          errMsg = errorData.error
        } catch (_) {
          // If response is not JSON, fallback to a localized message
        }
        throw new Error(errMsg || t("admin.products.toasts.exportFailedDesc"))
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.setAttribute("download", `products_${exportType}_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)

      toast({
        title: t("admin.products.toasts.exportCompleteTitle"),
        description: t("admin.products.toasts.exportCompleteDesc"),
      })
    } catch (error: any) {
      console.error("Error during export:", error)
      toast({
        title: t("admin.products.toasts.exportFailedTitle"),
        description: error.message || t("admin.products.toasts.exportFailedDesc"),
        variant: "destructive",
      })
    }
  }

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = filterCategory === "all" || product.category === filterCategory
    return matchesSearch && matchesCategory
  })


  const isAllSelected = filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length
  const isSomeSelected = selectedProductIds.size > 0 && selectedProductIds.size < filteredProducts.length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("admin.products.headerTitle")}</h1>
          <p className="text-gray-600">{t("admin.products.headerDescription")}</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                {t("admin.products.importDialog.triggerLabel")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("admin.products.importDialog.title")}</DialogTitle>
                <DialogDescription>{t("admin.products.importDialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">{t("admin.products.importDialog.csvFileLabel")}</Label>
                  <Input id="csv-file" type="file" accept=".csv" ref={importFileRef} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/docs/products_import_template.csv"
                    download
                    className="text-sm text-[#8B0000] underline underline-offset-4"
                  >
                    {t("admin.products.importDialog.downloadTemplateCsv")}
                  </a>
                  <a
                    href="/docs/products_import_template.xls"
                    download
                    className="text-sm text-[#8B0000] underline underline-offset-4"
                  >
                    {t("admin.products.importDialog.downloadTemplateXls")}
                  </a>
                </div>
                <p className="text-sm text-gray-500">{t("admin.products.importDialog.csvGuidelines")}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="button" className="bg-[#8B0000] hover:bg-[#6B0000]" onClick={handleImport}>
                  {t("admin.products.importDialog.uploadButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t("admin.products.exportMenu.triggerLabel")}
                <MoreHorizontal className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("all")}>{t("admin.products.exportMenu.exportAll")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("selected")} disabled={selectedProductIds.size === 0}>
                {t("admin.products.exportMenu.exportSelectedWithCount").replace("{count}", String(selectedProductIds.size))}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              if (open) {
                setIsDialogOpen(true)
                loadCategories()
              } else {
                handleDialogClose()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-[#8B0000] hover:bg-[#6B0000]">
                <Plus className="mr-2 h-4 w-4" />
                {t("admin.products.addButtonLabel")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? t("admin.products.editDialog.titleEdit") : t("admin.products.editDialog.titleAddNew")}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? t("admin.products.editDialog.descEdit") : t("admin.products.editDialog.descAddNew")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("admin.products.form.productNameLabel")}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">{t("admin.products.form.priceLabel")}</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="short_description">{t("admin.products.form.shortDescriptionLabel")}</Label>
                    <Input
                      id="short_description"
                      value={formData.short_description}
                      onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t("admin.products.form.descriptionLabel")}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">{t("admin.products.form.categoryLabel")}</Label>
                      <Select value={formData.category || ""} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                        <SelectTrigger id="category">
                          <SelectValue placeholder={t("admin.products.form.categoryPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="technique">{t("admin.products.form.techniqueLabel")}</Label>
                      <Input
                        id="technique"
                        value={formData.technique}
                        onChange={(e) => setFormData({ ...formData, technique: e.target.value })}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="has_archive_guide"
                        checked={formData.has_archive_guide}
                        onCheckedChange={(checked) => setFormData({ ...formData, has_archive_guide: checked })}
                        disabled={isSaving}
                      />
                      <Label htmlFor="has_archive_guide">{t("admin.products.form.hasArchiveGuideLabel")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="accepts_uploads"
                        checked={formData.accepts_uploads}
                        onCheckedChange={(checked) => setFormData({ ...formData, accepts_uploads: checked })}
                        disabled={isSaving}
                      />
                      <Label htmlFor="accepts_uploads">{t("admin.products.form.acceptsUploadsLabel")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_customizable"
                        checked={formData.is_customizable}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_customizable: checked })}
                        disabled={isSaving}
                      />
                      <Label htmlFor="is_customizable">{t("admin.products.form.isCustomizableLabel")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} disabled={isSaving} />
                      <Label htmlFor="is_active">{t("admin.products.form.activeLabel")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_featured"
                        checked={formData.is_featured}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                        disabled={isSaving}
                      />
                      <Label htmlFor="is_featured">{t("admin.products.form.featuredLabel")}</Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("admin.products.form.mediaLabel")}</Label>
                    <MediaManager items={mediaItems} onChange={setMediaItems} onRemoveExisting={handleRemoveMedia} disabled={isSaving} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("admin.products.form.variantGroupsLabel")}</Label>
                    <VariantGroupBuilder groups={variantGroups} onChange={setVariantGroups} disabled={isSaving} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("admin.products.form.specificationsLabel")}</Label>
                    <SpecificationsEditor value={specifications} onChange={setSpecifications} disabled={isSaving} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shipping_info">{t("admin.products.form.shippingInfoLabel")}</Label>
                    <Textarea
                      id="shipping_info"
                      value={formData.shipping_info}
                      onChange={(e) => setFormData({ ...formData, shipping_info: e.target.value })}
                      rows={4}
                      disabled={isSaving}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wholesale_tiers">{t("admin.products.form.wholesaleTiersLabel")}</Label>
                    <Textarea
                      id="wholesale_tiers"
                      value={formData.wholesale_tiers}
                      onChange={(e) => setFormData({ ...formData, wholesale_tiers: e.target.value })}
                      rows={4}
                      disabled={isSaving}
                      placeholder={t("admin.products.form.wholesaleTiersPlaceholder")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rating">{t("admin.products.form.ratingLabel")}</Label>
                      <Input
                        id="rating"
                        type="number"
                        step="0.1"
                        value={formData.rating}
                        onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="review_count">{t("admin.products.form.reviewCountLabel")}</Label>
                      <Input
                        id="review_count"
                        type="number"
                        value={formData.review_count}
                        onChange={(e) => setFormData({ ...formData, review_count: e.target.value })}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="image">{t("admin.products.form.legacyImageUrlLabel")}</Label>
                    <Input
                      id="image"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder={t("admin.products.form.imageUrlPlaceholder")}
                      disabled={isSaving}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose} disabled={isSaving}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" className="bg-[#8B0000] hover:bg-[#6B0000]" disabled={isSaving}>
                    {isSaving ? t("common.saving") : editingProduct ? t("admin.products.editDialog.buttons.update") : t("admin.products.editDialog.buttons.create")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.products.manageCategories")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t("admin.products.searchPlaceholder")}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={t("admin.products.filterByCategory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.products.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.products.cardTitleWithCount").replace("{count}", String(filteredProducts.length))}</CardTitle>
          <CardDescription>{t("admin.products.tableDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAllProducts}
                    aria-label={t("admin.products.aria.selectAll")}
                    className={isSomeSelected ? "indeterminate" : ""}
                  />
                </TableHead>
                <TableHead>{t("admin.products.table.product")}</TableHead>
                <TableHead>{t("admin.products.table.category")}</TableHead>
                <TableHead>{t("admin.products.table.price")}</TableHead>
                <TableHead>{t("admin.products.table.status")}</TableHead>
                <TableHead>{t("admin.products.table.created")}</TableHead>
                <TableHead className="text-right">{t("admin.products.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedProductIds.has(product.id)}
                      onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                      aria-label={t("admin.products.aria.selectProduct").replace("{name}", product.name)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image || "/placeholder.svg"}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.is_featured && (
                          <Badge variant="secondary" className="text-xs">
                            {t("admin.products.labels.featured")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{product.category || t("admin.products.na")}</TableCell>
                  <TableCell>${product.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? t("admin.products.statuses.active") : t("admin.products.statuses.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">{t("admin.products.noProductsFound")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open)
          if (open) {
            setEditingCategory(null)
            setCategoryForm({ name: "", description: "", is_active: true })
            loadCategories()
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.products.manageCategories")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("admin.products.categories.title")}</DialogTitle>
            <DialogDescription>{t("admin.products.categories.description")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cat-name">{t("admin.products.categories.name")}</Label>
                  <Input id="cat-name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-active">{t("admin.products.categories.active")}</Label>
                  <Switch id="cat-active" checked={categoryForm.is_active} onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_active: checked })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc">{t("admin.products.categories.descriptionLabel")}</Label>
                <Textarea id="cat-desc" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={3} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCategory(null)
                    setCategoryForm({ name: "", description: "", is_active: true })
                  }}
                >
                  {t("common.clear")}
                </Button>
                <Button
                  className="bg-[#8B0000] hover:bg-[#6B0000]"
                  onClick={async () => {
                    try {
                      if (!categoryForm.name.trim()) {
                        toast({ title: t("common.error"), description: t("admin.products.categories.nameRequired"), variant: "destructive" })
                        return
                      }
                      if (editingCategory) {
                        const { error } = await supabase
                          .from("categories")
                          .update({ name: categoryForm.name, description: categoryForm.description || null, is_active: categoryForm.is_active })
                          .eq("id", editingCategory.id)
                        if (error) throw error
                        toast({ title: t("common.success"), description: t("admin.products.categories.updated") })
                      } else {
                        const { error } = await supabase
                          .from("categories")
                          .insert([{ name: categoryForm.name, description: categoryForm.description || null, is_active: categoryForm.is_active }])
                        if (error) throw error
                        toast({ title: t("common.success"), description: t("admin.products.categories.created") })
                      }
                      setEditingCategory(null)
                      setCategoryForm({ name: "", description: "", is_active: true })
                      loadCategories()
                    } catch (error) {
                      console.error("Error saving category:", error)
                      toast({ title: t("common.error"), description: t("admin.products.categories.saveFailed"), variant: "destructive" })
                    }
                  }}
                >
                  {editingCategory ? t("admin.products.categories.update") : t("admin.products.categories.create")}
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.products.categories.table.name")}</TableHead>
                    <TableHead>{t("admin.products.categories.table.active")}</TableHead>
                    <TableHead className="text-right">{t("admin.products.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? t("common.active") : t("common.inactive")}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCategory(c)
                              setCategoryForm({ name: c.name || "", description: c.description || "", is_active: !!c.is_active })
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (!confirm(t("admin.products.categories.deleteConfirm"))) return
                              try {
                                const { error } = await supabase.from("categories").delete().eq("id", c.id)
                                if (error) throw error
                                toast({ title: t("common.success"), description: t("admin.products.categories.deleted") })
                                loadCategories()
                              } catch (error) {
                                console.error("Error deleting category:", error)
                                toast({ title: t("common.error"), description: t("admin.products.categories.deleteFailed"), variant: "destructive" })
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
