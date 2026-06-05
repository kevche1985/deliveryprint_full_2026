"use client"

import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDropzone } from "react-dropzone"
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/language-context"
import type {
  ServiceEditorState as BaseServiceEditorState,
  ServiceImage as BaseServiceImage,
  ServiceVariant as BaseServiceVariant,
  ServiceVariantOption as BaseServiceVariantOption,
} from "@/types/service"

export type ServiceRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  image: string | null
  price: number
  is_active: boolean
  is_featured: boolean
  slug: string | null
}

export type ServiceImage = BaseServiceImage
export type ServiceVariantOption = BaseServiceVariantOption
export type ServiceVariant = BaseServiceVariant

type EditorImage = ServiceImage & { uploading?: boolean }
type EditorVariant = ServiceVariant & { tempId: string }
type EditorOption = ServiceVariantOption & { tempId: string }

type ServiceEditorState = Omit<BaseServiceEditorState, "images" | "variants"> & {
  images: EditorImage[]
  variants: EditorVariant[]
}

type ServiceProductRow = {
  id: string
  name: string
  description: string | null
  base_price: number
  sort_order: number
  is_active: boolean
  config: any
}

type ProductImage = {
  id: string
  productId: string
  storagePath: string
  url: string
  altText?: string
  sortOrder: number
  isPrimary: boolean
  uploading?: boolean
}

type ProductVariantOption = {
  id: string
  tempId: string
  label: string
  priceDelta: number
  skuSuffix?: string
  sortOrder: number
  isActive: boolean
}

type ProductVariant = {
  id: string
  tempId: string
  name: string
  sortOrder: number
  options: ProductVariantOption[]
}

type EditorAction =
  | { type: "SET_FIELD"; field: keyof ServiceEditorState; value: unknown }
  | { type: "SET_IMAGES"; images: EditorImage[] }
  | { type: "ADD_IMAGE"; image: EditorImage }
  | { type: "REMOVE_IMAGE"; imageId: string }
  | { type: "REORDER_IMAGES"; orderedIds: string[] }
  | { type: "ADD_VARIANT"; serviceId: string }
  | { type: "UPDATE_VARIANT"; variantId: string; patch: Partial<EditorVariant> }
  | { type: "REMOVE_VARIANT"; variantId: string }
  | { type: "REORDER_VARIANTS"; orderedIds: string[] }
  | { type: "ADD_OPTION"; variantId: string }
  | { type: "UPDATE_OPTION"; variantId: string; optionId: string; patch: Partial<EditorOption> }
  | { type: "REMOVE_OPTION"; variantId: string; optionId: string }

const initialState: ServiceEditorState = {
  name: "",
  description: "",
  startingPrice: 0,
  category: "",
  slug: "",
  isActive: true,
  isFeatured: false,
  images: [],
  variants: [],
}

function ensureTempId(id: string) {
  if (id && !id.startsWith("new-")) return id
  return `new-${crypto.randomUUID()}`
}

function reducer(state: ServiceEditorState, action: EditorAction): ServiceEditorState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value } as ServiceEditorState
    case "SET_IMAGES":
      return { ...state, images: action.images }
    case "ADD_IMAGE":
      return { ...state, images: [...state.images, action.image] }
    case "REMOVE_IMAGE":
      return { ...state, images: state.images.filter((img) => img.id !== action.imageId) }
    case "REORDER_IMAGES": {
      const byId = new Map(state.images.map((img) => [img.id, img]))
      const next = action.orderedIds.map((id, idx) => {
        const img = byId.get(id)
        if (!img) return null
        return { ...img, sortOrder: idx, isPrimary: idx === 0 }
      })
      return { ...state, images: next.filter((x): x is EditorImage => !!x) }
    }
    case "ADD_VARIANT": {
      const tempId = ensureTempId("")
      const next: EditorVariant = {
        id: "",
        tempId,
        serviceId: action.serviceId,
        name: "",
        sortOrder: state.variants.length,
        options: [],
      }
      return { ...state, variants: [...state.variants, next] }
    }
    case "UPDATE_VARIANT":
      return {
        ...state,
        variants: state.variants.map((v) => (v.tempId === action.variantId ? { ...v, ...action.patch } : v)),
      }
    case "REMOVE_VARIANT":
      return { ...state, variants: state.variants.filter((v) => v.tempId !== action.variantId) }
    case "REORDER_VARIANTS": {
      const byId = new Map(state.variants.map((v) => [v.tempId, v]))
      const next = action.orderedIds.map((id, idx) => {
        const v = byId.get(id)
        if (!v) return null
        return { ...v, sortOrder: idx }
      })
      return { ...state, variants: next.filter((x): x is EditorVariant => !!x) }
    }
    case "ADD_OPTION":
      return {
        ...state,
        variants: state.variants.map((v) => {
          if (v.tempId !== action.variantId) return v
          const tempId = ensureTempId("")
          const nextOpt: EditorOption = {
            id: "",
            tempId,
            variantId: v.id,
            label: "",
            priceDelta: 0,
            skuSuffix: "",
            sortOrder: v.options.length,
            isActive: true,
          }
          return { ...v, options: [...v.options, nextOpt] }
        }),
      }
    case "UPDATE_OPTION":
      return {
        ...state,
        variants: state.variants.map((v) => {
          if (v.tempId !== action.variantId) return v
          return {
            ...v,
            options: v.options.map((o) => (o.tempId === action.optionId ? { ...o, ...action.patch } : o)),
          }
        }),
      }
    case "REMOVE_OPTION":
      return {
        ...state,
        variants: state.variants.map((v) => {
          if (v.tempId !== action.variantId) return v
          const next = v.options.filter((o) => o.tempId !== action.optionId).map((o, idx) => ({ ...o, sortOrder: idx }))
          return { ...v, options: next }
        }),
      }
    default:
      return state
  }
}

function SortableThumb({
  id,
  url,
  isPrimary,
  altText,
  uploading,
  disabled,
  onAltBlur,
  onDelete,
}: {
  id: string
  url: string
  isPrimary: boolean
  altText: string
  uploading?: boolean
  disabled?: boolean
  onAltBlur: (id: string, altText: string) => void
  onDelete: (id: string) => void
}) {
  const { t } = useLanguage()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: disabled || uploading })
  const [value, setValue] = useState(altText)
  useEffect(() => setValue(altText), [altText])
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""}>
      <div className="relative w-28 h-28 rounded-md overflow-hidden bg-gray-100 border border-gray-200">
        {uploading ? (
          <div className="w-full h-full animate-pulse bg-gray-200 flex items-center justify-center">
            <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
          </div>
        ) : (
          <img src={url} alt={altText || t("service.gallery.image_alt_fallback")} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-black/20 flex items-start justify-between p-1">
          <button
            type="button"
            className="rounded bg-white/90 p-1"
            onClick={() => onDelete(id)}
            disabled={disabled || uploading}
            aria-label={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded bg-white/90 p-1 cursor-grab"
            {...attributes}
            {...listeners}
            disabled={disabled || uploading}
            aria-label={t("service.gallery.reorder_aria")}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        {isPrimary ? (
          <div className="absolute left-1 bottom-1 text-[10px] bg-white/90 rounded px-1 py-0.5">{t("service.gallery.primary.badge")}</div>
        ) : null}
      </div>
      <Input
        className="mt-2 h-8 text-xs"
        placeholder={t("service.gallery.alt.placeholder")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onAltBlur(id, value)}
        disabled={disabled || uploading}
      />
    </div>
  )
}

function SortableVariantCard({
  id,
  name,
  disabled,
  onDelete,
  children,
}: {
  id: string
  name: string
  disabled?: boolean
  onDelete: () => void
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border border-gray-200 bg-white ${isDragging ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 flex-1">
          <button type="button" className="text-gray-400 cursor-grab" {...attributes} {...listeners} disabled={disabled} aria-label={t("service.variants.reorder_aria")}>
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="font-medium text-gray-900 truncate">{name || t("common.na")}</div>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onDelete} disabled={disabled} aria-label={t("common.delete")}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="border-t border-gray-200 p-3">{children}</div>
    </div>
  )
}

export default function EditServiceModal({
  open,
  onOpenChange,
  service,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: ServiceRow | null
  onSaved: () => void
}) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [serviceId, setServiceId] = useState<string | null>(service?.id ?? null)
  const [state, dispatch] = useReducer(reducer, initialState)
  const [activeTab, setActiveTab] = useState("general")
  const [isSaving, setIsSaving] = useState(false)
  const [products, setProducts] = useState<ServiceProductRow[]>([])
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [productBasePrice, setProductBasePrice] = useState(0)
  const [productIsActive, setProductIsActive] = useState(true)
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ""
  }, [])

  const loadImagesAndVariants = useCallback(
    async (id: string) => {
      const [imagesRes, variantsRes] = await Promise.all([
        supabase.from("service_images").select("*").eq("service_id", id).order("sort_order", { ascending: true }),
        supabase.from("service_variants").select("*, options:service_variant_options(*)").eq("service_id", id).order("sort_order", { ascending: true }),
      ])

      const images: EditorImage[] =
        (imagesRes.data || []).map((r: any) => ({
          id: String(r.id),
          serviceId: String(r.service_id),
          storagePath: String(r.storage_path),
          url: String(r.url),
          altText: r.alt_text ?? "",
          sortOrder: r.sort_order ?? 0,
          isPrimary: !!r.is_primary,
        })) || []

      const variants: EditorVariant[] =
        (variantsRes.data || []).map((v: any, idx: number) => ({
          id: String(v.id),
          tempId: String(v.id),
          serviceId: String(v.service_id),
          name: String(v.name || ""),
          sortOrder: v.sort_order ?? idx,
          options: ((v.options || []) as any[]).map((o: any, oIdx: number) => ({
            id: String(o.id),
            tempId: String(o.id),
            variantId: String(o.variant_id),
            label: String(o.label || ""),
            priceDelta: Number(o.price_delta ?? 0),
            skuSuffix: o.sku_suffix ?? "",
            sortOrder: o.sort_order ?? oIdx,
            isActive: o.is_active ?? true,
          })),
        })) || []

      dispatch({ type: "SET_IMAGES", images })
      dispatch({ type: "SET_FIELD", field: "variants", value: variants })
    },
    [dispatch],
  )

  const loadProducts = useCallback(async (id: string) => {
    const { data } = await supabase.from("service_products").select("*").eq("service_id", id).order("sort_order", { ascending: true })
    const rows = (data || []) as any[]
    const mapped: ServiceProductRow[] = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || ""),
      description: r.description ?? null,
      base_price: Number(r.base_price ?? 0),
      sort_order: Number(r.sort_order ?? 0),
      is_active: r.is_active ?? true,
      config: r.config ?? null,
    }))
    setProducts(mapped)
    if (mapped.length > 0) {
      setActiveProductId(mapped[0].id)
    } else {
      setActiveProductId(null)
    }
  }, [])

  const loadProductDetails = useCallback(async (productId: string) => {
    const [imagesRes, variantsRes] = await Promise.all([
      supabase.from("service_product_images").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
      supabase
        .from("service_product_variants")
        .select("*, options:service_product_variant_options(*)")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true }),
    ])

    const images: ProductImage[] =
      (imagesRes.data || []).map((r: any) => ({
        id: String(r.id),
        productId: String(r.product_id),
        storagePath: String(r.storage_path),
        url: String(r.url),
        altText: r.alt_text ?? "",
        sortOrder: r.sort_order ?? 0,
        isPrimary: !!r.is_primary,
      })) || []

    const variants: ProductVariant[] =
      (variantsRes.data || []).map((v: any, idx: number) => ({
        id: String(v.id),
        tempId: String(v.id),
        name: String(v.name || ""),
        sortOrder: v.sort_order ?? idx,
        options: ((v.options || []) as any[]).map((o: any, oIdx: number) => ({
          id: String(o.id),
          tempId: String(o.id),
          label: String(o.label || ""),
          priceDelta: Number(o.price_delta ?? 0),
          skuSuffix: o.sku_suffix ?? "",
          sortOrder: o.sort_order ?? oIdx,
          isActive: o.is_active ?? true,
        })),
      })) || []

    setProductImages(images)
    setProductVariants(variants)
  }, [])

  useEffect(() => {
    if (!open) return
    const svc = service
    if (svc) {
      setServiceId(svc.id)
      dispatch({ type: "SET_FIELD", field: "name", value: svc.name })
      dispatch({ type: "SET_FIELD", field: "description", value: svc.description || "" })
      dispatch({ type: "SET_FIELD", field: "category", value: svc.category || "" })
      dispatch({ type: "SET_FIELD", field: "slug", value: svc.slug || "" })
      dispatch({ type: "SET_FIELD", field: "startingPrice", value: Number(svc.price ?? 0) })
      dispatch({ type: "SET_FIELD", field: "isActive", value: svc.is_active })
      dispatch({ type: "SET_FIELD", field: "isFeatured", value: svc.is_featured })
      loadImagesAndVariants(svc.id).catch(() => {})
      loadProducts(svc.id).catch(() => {})
      setActiveTab("general")
      return
    }

    setServiceId(null)
    setActiveTab("general")
    dispatch({ type: "SET_FIELD", field: "name", value: "" })
    dispatch({ type: "SET_FIELD", field: "description", value: "" })
    dispatch({ type: "SET_FIELD", field: "category", value: "" })
    dispatch({ type: "SET_FIELD", field: "slug", value: "" })
    dispatch({ type: "SET_FIELD", field: "startingPrice", value: 0 })
    dispatch({ type: "SET_FIELD", field: "isActive", value: true })
    dispatch({ type: "SET_FIELD", field: "isFeatured", value: false })
    dispatch({ type: "SET_IMAGES", images: [] })
    dispatch({ type: "SET_FIELD", field: "variants", value: [] })
    setProducts([])
    setActiveProductId(null)
    setProductName("")
    setProductDescription("")
    setProductBasePrice(0)
    setProductIsActive(true)
    setProductImages([])
    setProductVariants([])
  }, [open, service, loadImagesAndVariants, loadProducts])

  useEffect(() => {
    if (!activeProductId) return
    const row = products.find((p) => p.id === activeProductId)
    if (!row) return
    setProductName(row.name)
    setProductDescription(row.description ?? "")
    setProductBasePrice(Number(row.base_price ?? 0))
    setProductIsActive(!!row.is_active)
    loadProductDetails(activeProductId).catch(() => {})
  }, [activeProductId, products, loadProductDetails])

  const priceRange = useMemo(() => {
    const deltas = state.variants
      .flatMap((v) => v.options)
      .map((o) => Number(o.priceDelta))
      .filter((n) => Number.isFinite(n) && n !== 0)
    if (deltas.length === 0) return null
    const min = Math.min(...deltas)
    const max = Math.max(...deltas)
    return { min: state.startingPrice + min, max: state.startingPrice + max }
  }, [state.startingPrice, state.variants])

  const variantsCount = state.variants.length
  const imagesCount = state.images.length

  const canUseExtras = !!serviceId
  const canUseProductExtras = !!serviceId && !!activeProductId
  const productsCount = products.length

  const onDropFiles = useCallback(
    async (files: File[]) => {
      if (!serviceId) return
      if (state.images.length >= 10) return

      const token = await getToken()
      if (!token) {
        toast({ title: t("common.error"), description: t("common.unauthorized"), variant: "destructive" })
        return
      }

      let count = state.images.length
      for (const file of files) {
        if (count >= 10) break
        const tempId = `new-${crypto.randomUUID()}`
        const previewUrl = URL.createObjectURL(file)
        dispatch({
          type: "ADD_IMAGE",
          image: {
            id: tempId,
            serviceId,
            storagePath: "",
            url: previewUrl,
            altText: "",
            sortOrder: count,
            isPrimary: count === 0,
            uploading: true,
          },
        })
        count += 1

        try {
          const form = new FormData()
          form.append("file", file)
          const res = await fetch(`/api/admin/services/${serviceId}/images`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            toast({ title: t("common.error"), description: err?.error || t("service.gallery.upload_failed"), variant: "destructive" })
            dispatch({ type: "REMOVE_IMAGE", imageId: tempId })
            continue
          }
          const payload = await res.json()
          dispatch({ type: "REMOVE_IMAGE", imageId: tempId })
          dispatch({
            type: "ADD_IMAGE",
            image: {
              id: payload.image.id,
              serviceId: payload.image.serviceId,
              storagePath: payload.image.storagePath,
              url: payload.image.url,
              altText: payload.image.altText ?? "",
              sortOrder: payload.image.sortOrder,
              isPrimary: payload.image.isPrimary,
            },
          })
          await loadImagesAndVariants(serviceId)
        } catch {
          dispatch({ type: "REMOVE_IMAGE", imageId: tempId })
          toast({ title: t("common.error"), description: t("service.gallery.upload_failed"), variant: "destructive" })
        }
      }
    },
    [getToken, loadImagesAndVariants, serviceId, state.images.length, t, toast],
  )

  const dropzone = useDropzone({
    disabled: !canUseExtras || imagesCount >= 10,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    maxSize: 5 * 1024 * 1024,
    onDrop: onDropFiles,
  })

  const reorderImages = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const current = state.images.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      const from = current.findIndex((i) => i.id === active.id)
      const to = current.findIndex((i) => i.id === over.id)
      if (from === -1 || to === -1) return
      const moved = arrayMove(current, from, to).map((img, idx) => ({ ...img, sortOrder: idx, isPrimary: idx === 0 }))
      dispatch({ type: "SET_IMAGES", images: moved })

      const persistedIds = moved.filter((i) => !i.id.startsWith("new-")).map((i) => i.id)
      if (!serviceId || persistedIds.length !== moved.length) return

      const token = await getToken()
      await fetch(`/api/admin/services/${serviceId}/images/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderedIds: persistedIds }),
      })
      await loadImagesAndVariants(serviceId)
    },
    [getToken, loadImagesAndVariants, serviceId, state.images],
  )

  const deleteImage = useCallback(
    async (imageId: string) => {
      if (!serviceId) return
      if (imageId.startsWith("new-")) {
        dispatch({ type: "REMOVE_IMAGE", imageId })
        return
      }
      const token = await getToken()
      const res = await fetch(`/api/admin/services/${serviceId}/images/${imageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        toast({ title: t("common.error"), description: t("service.gallery.delete_failed"), variant: "destructive" })
        return
      }
      await loadImagesAndVariants(serviceId)
    },
    [getToken, loadImagesAndVariants, serviceId, t, toast],
  )

  const saveAltText = useCallback(
    async (imageId: string, altText: string) => {
      if (!serviceId) return
      if (imageId.startsWith("new-")) return
      const token = await getToken()
      await fetch(`/api/admin/services/${serviceId}/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ altText }),
      })
    },
    [getToken, serviceId],
  )

  const onDropProductFiles = useCallback(
    async (files: File[]) => {
      if (!serviceId || !activeProductId) return
      if (productImages.length >= 10) return

      const token = await getToken()
      if (!token) {
        toast({ title: t("common.error"), description: t("common.unauthorized"), variant: "destructive" })
        return
      }

      let count = productImages.length
      for (const file of files) {
        if (count >= 10) break
        const tempId = `new-${crypto.randomUUID()}`
        const previewUrl = URL.createObjectURL(file)
        setProductImages((prev) =>
          prev.concat([
            {
              id: tempId,
              productId: activeProductId,
              storagePath: "",
              url: previewUrl,
              altText: "",
              sortOrder: count,
              isPrimary: count === 0,
              uploading: true,
            },
          ]),
        )
        count += 1

        try {
          const form = new FormData()
          form.append("file", file)
          const res = await fetch(`/api/admin/services/${serviceId}/products/${activeProductId}/images`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            toast({ title: t("common.error"), description: err?.error || t("service.gallery.upload_failed"), variant: "destructive" })
            setProductImages((prev) => prev.filter((i) => i.id !== tempId))
            continue
          }
          setProductImages((prev) => prev.filter((i) => i.id !== tempId))
          await loadProductDetails(activeProductId)
        } catch {
          setProductImages((prev) => prev.filter((i) => i.id !== tempId))
          toast({ title: t("common.error"), description: t("service.gallery.upload_failed"), variant: "destructive" })
        }
      }
    },
    [activeProductId, getToken, loadProductDetails, productImages.length, serviceId, t, toast],
  )

  const productDropzone = useDropzone({
    disabled: !canUseProductExtras || productImages.length >= 10,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    maxSize: 5 * 1024 * 1024,
    onDrop: onDropProductFiles,
  })

  const reorderProductImages = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const current = productImages.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      const from = current.findIndex((i) => i.id === active.id)
      const to = current.findIndex((i) => i.id === over.id)
      if (from === -1 || to === -1) return
      const moved = arrayMove(current, from, to).map((img, idx) => ({ ...img, sortOrder: idx, isPrimary: idx === 0 }))
      setProductImages(moved)

      const persistedIds = moved.filter((i) => !i.id.startsWith("new-")).map((i) => i.id)
      if (!serviceId || !activeProductId || persistedIds.length !== moved.length) return

      const token = await getToken()
      await fetch(`/api/admin/services/${serviceId}/products/${activeProductId}/images/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderedIds: persistedIds }),
      })
      await loadProductDetails(activeProductId)
    },
    [activeProductId, getToken, loadProductDetails, productImages, serviceId],
  )

  const deleteProductImage = useCallback(
    async (imageId: string) => {
      if (!serviceId || !activeProductId) return
      if (imageId.startsWith("new-")) {
        setProductImages((prev) => prev.filter((i) => i.id !== imageId))
        return
      }
      const token = await getToken()
      const res = await fetch(`/api/admin/services/${serviceId}/products/${activeProductId}/images/${imageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        toast({ title: t("common.error"), description: t("service.gallery.delete_failed"), variant: "destructive" })
        return
      }
      await loadProductDetails(activeProductId)
    },
    [activeProductId, getToken, loadProductDetails, serviceId, t, toast],
  )

  const saveProductAltText = useCallback(
    async (imageId: string, altText: string) => {
      if (!serviceId || !activeProductId) return
      if (imageId.startsWith("new-")) return
      const token = await getToken()
      await fetch(`/api/admin/services/${serviceId}/products/${activeProductId}/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ altText }),
      })
    },
    [activeProductId, getToken, serviceId],
  )

  const variantDuplicateLabels = useMemo(() => {
    const map = new Map<string, Set<string>>()
    state.variants.forEach((v) => {
      const counts = new Map<string, number>()
      v.options.forEach((o) => {
        const key = o.label.trim().toLowerCase()
        if (!key) return
        counts.set(key, (counts.get(key) || 0) + 1)
      })
      const dups = new Set<string>()
      counts.forEach((c, k) => {
        if (c > 1) dups.add(k)
      })
      map.set(v.tempId, dups)
    })
    return map
  }, [state.variants])

  const onSave = useCallback(async () => {
    setIsSaving(true)
    try {
      if (!state.name.trim()) {
        toast({ title: t("common.error"), description: t("service.editor.validation.name_required"), variant: "destructive" })
        return
      }

      if (state.isActive && state.images.length === 0) {
        toast({ title: t("common.error"), description: t("service.editor.validation.publish_requires_image"), variant: "destructive" })
      }

      const badVariant = state.variants.find((v) => !v.name.trim() || v.name.trim().length > 60 || v.options.length === 0)
      if (badVariant) {
        toast({ title: t("common.error"), description: t("service.editor.validation.variant_invalid"), variant: "destructive" })
        return
      }

      const badOption = state.variants
        .flatMap((v) => v.options)
        .find((o) => !o.label.trim() || o.label.trim().length > 80 || !Number.isFinite(Number(o.priceDelta)))
      if (badOption) {
        toast({ title: t("common.error"), description: t("service.editor.validation.option_invalid"), variant: "destructive" })
        return
      }

      for (const [variantId, dups] of variantDuplicateLabels.entries()) {
        if (dups.size > 0) {
          toast({ title: t("common.error"), description: t("service.editor.validation.duplicate_option_labels"), variant: "destructive" })
          return
        }
      }

      const payload = {
        name: state.name.trim(),
        description: state.description.trim() ? state.description.trim() : null,
        category: state.category.trim() ? state.category.trim() : null,
        image: null,
        price: Number.isFinite(state.startingPrice) ? Number(state.startingPrice) : 0,
        slug: state.slug.trim() ? state.slug.trim() : null,
        is_active: state.isActive,
        is_featured: state.isFeatured,
      }

      let id = serviceId
      if (!id) {
        const { data, error } = await supabase.from("services").insert([payload]).select("*").single()
        if (error || !data?.id) {
          toast({ title: t("common.error"), description: t("service.editor.errors.create_failed"), variant: "destructive" })
          return
        }
        id = String(data.id)
        setServiceId(id)
      } else {
        const { error } = await supabase.from("services").update(payload).eq("id", id)
        if (error) {
          toast({ title: t("common.error"), description: t("service.editor.errors.update_failed"), variant: "destructive" })
          return
        }
      }

      const token = await getToken()
      const variantsPayload = state.variants
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((v, idx) => ({
          id: v.id || "",
          name: v.name.trim(),
          sortOrder: idx,
          options: v.options
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((o, oIdx) => ({
              id: o.id || "",
              label: o.label.trim(),
              priceDelta: Number(o.priceDelta || 0),
              skuSuffix: o.skuSuffix?.trim() || "",
              sortOrder: oIdx,
              isActive: !!o.isActive,
            })),
        }))

      const res = await fetch(`/api/admin/services/${id}/variants`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variants: variantsPayload }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: t("common.error"), description: err?.error || t("service.editor.errors.save_variants_failed"), variant: "destructive" })
        return
      }

      await loadImagesAndVariants(id)
      toast({ title: t("common.success"), description: serviceId ? t("service.editor.saved_updated") : t("service.editor.saved_created") })
      onSaved()
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }, [getToken, loadImagesAndVariants, onOpenChange, onSaved, serviceId, state, t, toast, variantDuplicateLabels])

  const reorderVariants = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const current = state.variants.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      const from = current.findIndex((v) => v.tempId === active.id)
      const to = current.findIndex((v) => v.tempId === over.id)
      if (from === -1 || to === -1) return
      const moved = arrayMove(current, from, to)
      dispatch({ type: "REORDER_VARIANTS", orderedIds: moved.map((v) => v.tempId) })
    },
    [state.variants],
  )

  const productVariantDuplicateLabels = useMemo(() => {
    const map = new Map<string, Set<string>>()
    productVariants.forEach((v) => {
      const counts = new Map<string, number>()
      v.options.forEach((o) => {
        const key = o.label.trim().toLowerCase()
        if (!key) return
        counts.set(key, (counts.get(key) || 0) + 1)
      })
      const dups = new Set<string>()
      counts.forEach((c, k) => {
        if (c > 1) dups.add(k)
      })
      map.set(v.tempId, dups)
    })
    return map
  }, [productVariants])

  const addProductVariant = useCallback(() => {
    const tempId = `new-${crypto.randomUUID()}`
    setProductVariants((prev) =>
      prev.concat([{ id: "", tempId, name: "", sortOrder: prev.length, options: [{ id: "", tempId: `new-${crypto.randomUUID()}`, label: "", priceDelta: 0, skuSuffix: "", sortOrder: 0, isActive: true }] }]),
    )
  }, [])

  const updateProductVariant = useCallback((variantId: string, patch: Partial<ProductVariant>) => {
    setProductVariants((prev) => prev.map((v) => (v.tempId === variantId ? { ...v, ...patch } : v)))
  }, [])

  const removeProductVariant = useCallback((variantId: string) => {
    setProductVariants((prev) => prev.filter((v) => v.tempId !== variantId).map((v, idx) => ({ ...v, sortOrder: idx })))
  }, [])

  const addProductOption = useCallback((variantId: string) => {
    setProductVariants((prev) =>
      prev.map((v) => {
        if (v.tempId !== variantId) return v
        const next = v.options.concat([
          { id: "", tempId: `new-${crypto.randomUUID()}`, label: "", priceDelta: 0, skuSuffix: "", sortOrder: v.options.length, isActive: true },
        ])
        return { ...v, options: next }
      }),
    )
  }, [])

  const updateProductOption = useCallback((variantId: string, optionId: string, patch: Partial<ProductVariantOption>) => {
    setProductVariants((prev) =>
      prev.map((v) => {
        if (v.tempId !== variantId) return v
        return { ...v, options: v.options.map((o) => (o.tempId === optionId ? { ...o, ...patch } : o)) }
      }),
    )
  }, [])

  const removeProductOption = useCallback((variantId: string, optionId: string) => {
    setProductVariants((prev) =>
      prev.map((v) => {
        if (v.tempId !== variantId) return v
        const next = v.options.filter((o) => o.tempId !== optionId).map((o, idx) => ({ ...o, sortOrder: idx }))
        return { ...v, options: next }
      }),
    )
  }, [])

  const reorderProductVariants = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const current = productVariants.slice().sort((a, b) => a.sortOrder - b.sortOrder)
      const from = current.findIndex((v) => v.tempId === active.id)
      const to = current.findIndex((v) => v.tempId === over.id)
      if (from === -1 || to === -1) return
      const moved = arrayMove(current, from, to).map((v, idx) => ({ ...v, sortOrder: idx }))
      setProductVariants(moved)
    },
    [productVariants],
  )

  const addProduct = useCallback(async () => {
    if (!serviceId) return
    const token = await getToken()
    if (!token) {
      toast({ title: t("common.error"), description: t("common.unauthorized"), variant: "destructive" })
      return
    }
    const res = await fetch(`/api/admin/services/${serviceId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: t("service.products.new_name") }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: t("common.error"), description: err?.error || t("common.error"), variant: "destructive" })
      return
    }
    const payload = await res.json()
    await loadProducts(serviceId)
    if (payload?.product?.id) setActiveProductId(String(payload.product.id))
    setActiveTab("products")
  }, [getToken, loadProducts, serviceId, t, toast])

  const saveProduct = useCallback(async () => {
    if (!serviceId || !activeProductId) return
    const token = await getToken()
    if (!token) {
      toast({ title: t("common.error"), description: t("common.unauthorized"), variant: "destructive" })
      return
    }

    const res = await fetch(`/api/admin/services/${serviceId}/products/${activeProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: productName, description: productDescription, basePrice: productBasePrice, isActive: productIsActive }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast({ title: t("common.error"), description: err?.error || t("common.error"), variant: "destructive" })
      return
    }

    for (const [variantId, dups] of productVariantDuplicateLabels.entries()) {
      if (dups.size > 0) {
        toast({ title: t("common.error"), description: t("service.editor.validation.duplicate_option_labels"), variant: "destructive" })
        return
      }
      const variant = productVariants.find((v) => v.tempId === variantId)
      if (variant && (!variant.name.trim() || variant.options.length === 0)) {
        toast({ title: t("common.error"), description: t("service.editor.validation.variant_invalid"), variant: "destructive" })
        return
      }
    }

    const variantsPayload = productVariants
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v, idx) => ({
        id: v.id && !v.id.startsWith("new-") ? v.id : "",
        name: v.name,
        sortOrder: idx,
        options: v.options
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((o, oIdx) => ({
            id: o.id && !o.id.startsWith("new-") ? o.id : "",
            label: o.label,
            priceDelta: Number(o.priceDelta),
            skuSuffix: o.skuSuffix || "",
            sortOrder: oIdx,
            isActive: !!o.isActive,
          })),
      }))

    const vr = await fetch(`/api/admin/services/${serviceId}/products/${activeProductId}/variants`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ variants: variantsPayload }),
    })
    if (!vr.ok) {
      const err = await vr.json().catch(() => ({}))
      toast({ title: t("common.error"), description: err?.error || t("service.editor.errors.save_variants_failed"), variant: "destructive" })
      return
    }

    await loadProducts(serviceId)
    await loadProductDetails(activeProductId)
    toast({ title: t("common.success"), description: t("service.products.saved") })
  }, [
    activeProductId,
    getToken,
    loadProductDetails,
    loadProducts,
    productBasePrice,
    productDescription,
    productIsActive,
    productName,
    productVariantDuplicateLabels,
    productVariants,
    serviceId,
    t,
    toast,
  ])

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!serviceId) return
      const token = await getToken()
      if (!token) {
        toast({ title: t("common.error"), description: t("common.unauthorized"), variant: "destructive" })
        return
      }
      const res = await fetch(`/api/admin/services/${serviceId}/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: t("common.error"), description: err?.error || t("common.error"), variant: "destructive" })
        return
      }
      await loadProducts(serviceId)
    },
    [getToken, loadProducts, serviceId, t, toast],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{service ? t("service.editor.title_edit") : t("service.editor.title_add_new")}</DialogTitle>
          <DialogDescription>{t("service.editor.description")}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">{t("service.editor.tabs.general")}</TabsTrigger>
            <TabsTrigger value="gallery" disabled={!canUseExtras}>
              {t("service.editor.tabs.gallery")} ({imagesCount})
            </TabsTrigger>
            <TabsTrigger value="variants" disabled={!canUseExtras}>
              {t("service.editor.tabs.variants")} ({variantsCount})
            </TabsTrigger>
            <TabsTrigger value="products" disabled={!canUseExtras}>
              {t("service.editor.tabs.products")} ({productsCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.services.form.name")}</Label>
                <Input value={state.name} onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })} disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.services.form.startingPrice")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={String(state.startingPrice)}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "startingPrice", value: Number.parseFloat(e.target.value || "0") })}
                  disabled={isSaving}
                />
                {priceRange ? (
                  <p className="text-xs text-gray-500">
                    {t("service.variants.price_range")
                      .replace("{{min}}", `$${priceRange.min.toFixed(2)}`)
                      .replace("{{max}}", `$${priceRange.max.toFixed(2)}`)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.services.form.description")}</Label>
              <Textarea value={state.description} onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })} rows={4} disabled={isSaving} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.services.form.category")}</Label>
                <Input value={state.category} onChange={(e) => dispatch({ type: "SET_FIELD", field: "category", value: e.target.value })} disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.services.form.slug")}</Label>
                <Input value={state.slug} onChange={(e) => dispatch({ type: "SET_FIELD", field: "slug", value: e.target.value })} disabled={isSaving} />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch checked={state.isActive} onCheckedChange={(v) => dispatch({ type: "SET_FIELD", field: "isActive", value: v })} disabled={isSaving} />
                <Label>{t("admin.services.form.active")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch checked={state.isFeatured} onCheckedChange={(v) => dispatch({ type: "SET_FIELD", field: "isFeatured", value: v })} disabled={isSaving} />
                <Label>{t("admin.services.form.featured")}</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-4 pt-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    {...dropzone.getRootProps()}
                    className={`rounded-lg border border-dashed p-6 text-center ${
                      dropzone.isDragActive ? "border-[#8B0000] bg-red-50" : "border-gray-300"
                    } ${imagesCount >= 10 ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    aria-disabled={imagesCount >= 10}
                  >
                    <input {...dropzone.getInputProps()} />
                    <p className="text-sm font-medium">{t("service.gallery.dropzone.label")}</p>
                    <p className="text-xs text-gray-500 mt-1">{imagesCount >= 10 ? t("service.gallery.dropzone.limit") : t("service.gallery.dropzone.hint")}</p>
                  </div>
                </TooltipTrigger>
                {imagesCount >= 10 ? <TooltipContent>{t("service.gallery.dropzone.limit")}</TooltipContent> : null}
              </Tooltip>
            </TooltipProvider>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderImages}>
              <SortableContext items={state.images.map((i) => i.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {state.images
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((img) => (
                      <SortableThumb
                        key={img.id}
                        id={img.id}
                        url={img.url}
                        isPrimary={img.isPrimary}
                        altText={img.altText || ""}
                        uploading={img.uploading}
                        disabled={isSaving}
                        onAltBlur={saveAltText}
                        onDelete={deleteImage}
                      />
                    ))}
                </div>
              </SortableContext>
            </DndContext>
          </TabsContent>

          <TabsContent value="variants" className="space-y-4 pt-4">
            {state.variants.length === 0 ? <p className="text-sm text-gray-500">{t("service.variants.empty")}</p> : null}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderVariants}>
              <SortableContext items={state.variants.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((v) => v.tempId)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {state.variants
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((variant) => (
                      <SortableVariantCard
                        key={variant.tempId}
                        id={variant.tempId}
                        name={variant.name}
                        disabled={isSaving}
                        onDelete={() => dispatch({ type: "REMOVE_VARIANT", variantId: variant.tempId })}
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>{t("service.variants.name.label")}</Label>
                            <Input
                              value={variant.name}
                              onChange={(e) => dispatch({ type: "UPDATE_VARIANT", variantId: variant.tempId, patch: { name: e.target.value } })}
                              disabled={isSaving}
                            />
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("service.variants.option.label")}</TableHead>
                                <TableHead className="w-[160px]">{t("service.variants.option.price_delta")}</TableHead>
                                <TableHead className="w-[160px]">{t("service.variants.option.sku_suffix")}</TableHead>
                                <TableHead className="w-[110px]">{t("common.active")}</TableHead>
                                <TableHead className="w-[44px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {variant.options.map((opt) => {
                                const dupSet = variantDuplicateLabels.get(variant.tempId) || new Set<string>()
                                const isDup = !!opt.label.trim() && dupSet.has(opt.label.trim().toLowerCase())
                                return (
                                  <TableRow key={opt.tempId}>
                                    <TableCell>
                                      <Input
                                        value={opt.label}
                                        onChange={(e) =>
                                          dispatch({ type: "UPDATE_OPTION", variantId: variant.tempId, optionId: opt.tempId, patch: { label: e.target.value } })
                                        }
                                        disabled={isSaving}
                                        className={isDup ? "border-yellow-400" : ""}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={String(opt.priceDelta)}
                                        onChange={(e) =>
                                          dispatch({
                                            type: "UPDATE_OPTION",
                                            variantId: variant.tempId,
                                            optionId: opt.tempId,
                                            patch: { priceDelta: Number.parseFloat(e.target.value || "0") },
                                          })
                                        }
                                        disabled={isSaving}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={opt.skuSuffix || ""}
                                        onChange={(e) =>
                                          dispatch({ type: "UPDATE_OPTION", variantId: variant.tempId, optionId: opt.tempId, patch: { skuSuffix: e.target.value } })
                                        }
                                        disabled={isSaving}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Switch
                                        checked={opt.isActive}
                                        onCheckedChange={(v) =>
                                          dispatch({ type: "UPDATE_OPTION", variantId: variant.tempId, optionId: opt.tempId, patch: { isActive: v } })
                                        }
                                        disabled={isSaving}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => dispatch({ type: "REMOVE_OPTION", variantId: variant.tempId, optionId: opt.tempId })}
                                        disabled={isSaving}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                              <TableRow>
                                <TableCell colSpan={5}>
                                  <Button type="button" variant="outline" onClick={() => dispatch({ type: "ADD_OPTION", variantId: variant.tempId })} disabled={isSaving}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t("service.variants.add_option")}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </SortableVariantCard>
                    ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button type="button" variant="outline" onClick={() => dispatch({ type: "ADD_VARIANT", serviceId: serviceId || "" })} disabled={isSaving}>
              <Plus className="mr-2 h-4 w-4" />
              {t("service.variants.add_variant")}
            </Button>
          </TabsContent>

          <TabsContent value="products" className="space-y-4 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-500">{t("service.products.hint")}</div>
              <Button type="button" variant="outline" onClick={addProduct} disabled={isSaving || !serviceId}>
                <Plus className="mr-2 h-4 w-4" />
                {t("service.products.add")}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-2">
                <div className="rounded-lg border border-gray-200 bg-white">
                  <div className="p-2 space-y-1">
                    {products.length === 0 ? (
                      <div className="text-sm text-gray-500 p-2">{t("service.products.empty")}</div>
                    ) : (
                      products
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((p) => (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-2 cursor-pointer ${
                              activeProductId === p.id ? "bg-red-50 border border-red-200" : "hover:bg-gray-50"
                            }`}
                            onClick={() => setActiveProductId(p.id)}
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{p.name || t("common.na")}</div>
                              <div className="text-xs text-gray-500 truncate">${Number(p.base_price ?? 0).toFixed(2)}</div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteProduct(p.id)
                              }}
                              disabled={isSaving}
                              aria-label={t("common.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="col-span-2 space-y-4">
                {!activeProductId ? (
                  <div className="text-sm text-gray-500">{t("service.products.select")}</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("service.products.fields.name")}</Label>
                        <Input value={productName} onChange={(e) => setProductName(e.target.value)} disabled={isSaving} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("service.products.fields.base_price")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={String(productBasePrice)}
                          onChange={(e) => setProductBasePrice(Number.parseFloat(e.target.value || "0"))}
                          disabled={isSaving}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{t("service.products.fields.description")}</Label>
                      <Textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={3} disabled={isSaving} />
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch checked={productIsActive} onCheckedChange={setProductIsActive} disabled={isSaving} />
                      <Label>{t("common.active")}</Label>
                    </div>

                    <div className="space-y-3">
                      <Label>{t("service.products.gallery")}</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              {...productDropzone.getRootProps()}
                              className={`rounded-lg border border-dashed p-5 text-center ${
                                productDropzone.isDragActive ? "border-[#8B0000] bg-red-50" : "border-gray-300"
                              } ${productImages.length >= 10 ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                              aria-disabled={productImages.length >= 10}
                            >
                              <input {...productDropzone.getInputProps()} />
                              <p className="text-sm font-medium">{t("service.gallery.dropzone.label")}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {productImages.length >= 10 ? t("service.gallery.dropzone.limit") : t("service.gallery.dropzone.hint")}
                              </p>
                            </div>
                          </TooltipTrigger>
                          {productImages.length >= 10 ? <TooltipContent>{t("service.gallery.dropzone.limit")}</TooltipContent> : null}
                        </Tooltip>
                      </TooltipProvider>

                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderProductImages}>
                        <SortableContext items={productImages.map((i) => i.id)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            {productImages
                              .slice()
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((img, idx) => (
                                <SortableThumb
                                  key={img.id}
                                  id={img.id}
                                  url={img.url}
                                  altText={img.altText || ""}
                                  isPrimary={idx === 0}
                                  uploading={img.uploading}
                                  disabled={isSaving}
                                  onAltBlur={saveProductAltText}
                                  onDelete={deleteProductImage}
                                />
                              ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>{t("service.products.variants")}</Label>
                        <Button type="button" variant="outline" onClick={addProductVariant} disabled={isSaving}>
                          <Plus className="mr-2 h-4 w-4" />
                          {t("service.variants.add_variant")}
                        </Button>
                      </div>

                      {productVariants.length === 0 ? <p className="text-sm text-gray-500">{t("service.variants.empty")}</p> : null}

                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderProductVariants}>
                        <SortableContext
                          items={productVariants.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((v) => v.tempId)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {productVariants
                              .slice()
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((variant) => (
                                <SortableVariantCard key={variant.tempId} id={variant.tempId} name={variant.name} disabled={isSaving} onDelete={() => removeProductVariant(variant.tempId)}>
                                  <div className="space-y-3">
                                    <div className="space-y-2">
                                      <Label>{t("service.variants.name.label")}</Label>
                                      <Input value={variant.name} onChange={(e) => updateProductVariant(variant.tempId, { name: e.target.value })} disabled={isSaving} />
                                    </div>

                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>{t("service.variants.option.label")}</TableHead>
                                          <TableHead className="w-[160px]">{t("service.variants.option.price_delta")}</TableHead>
                                          <TableHead className="w-[160px]">{t("service.variants.option.sku_suffix")}</TableHead>
                                          <TableHead className="w-[110px]">{t("common.active")}</TableHead>
                                          <TableHead className="w-[44px]"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {variant.options.map((opt) => {
                                          const dupSet = productVariantDuplicateLabels.get(variant.tempId) || new Set<string>()
                                          const isDup = !!opt.label.trim() && dupSet.has(opt.label.trim().toLowerCase())
                                          return (
                                            <TableRow key={opt.tempId}>
                                              <TableCell>
                                                <Input
                                                  value={opt.label}
                                                  onChange={(e) => updateProductOption(variant.tempId, opt.tempId, { label: e.target.value })}
                                                  disabled={isSaving}
                                                  className={isDup ? "border-yellow-400" : ""}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  value={String(opt.priceDelta)}
                                                  onChange={(e) => updateProductOption(variant.tempId, opt.tempId, { priceDelta: Number.parseFloat(e.target.value || "0") })}
                                                  disabled={isSaving}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Input
                                                  value={opt.skuSuffix || ""}
                                                  onChange={(e) => updateProductOption(variant.tempId, opt.tempId, { skuSuffix: e.target.value })}
                                                  disabled={isSaving}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Switch
                                                  checked={opt.isActive}
                                                  onCheckedChange={(v) => updateProductOption(variant.tempId, opt.tempId, { isActive: v })}
                                                  disabled={isSaving}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="icon"
                                                  onClick={() => removeProductOption(variant.tempId, opt.tempId)}
                                                  disabled={isSaving}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          )
                                        })}
                                        <TableRow>
                                          <TableCell colSpan={5}>
                                            <Button type="button" variant="outline" onClick={() => addProductOption(variant.tempId)} disabled={isSaving}>
                                              <Plus className="mr-2 h-4 w-4" />
                                              {t("service.variants.add_option")}
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                </SortableVariantCard>
                              ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>

                    <Button type="button" className="bg-[#8B0000] hover:bg-[#6B0000]" onClick={saveProduct} disabled={isSaving}>
                      {t("service.products.save")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" className="bg-[#8B0000] hover:bg-[#6B0000]" onClick={onSave} disabled={isSaving}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
