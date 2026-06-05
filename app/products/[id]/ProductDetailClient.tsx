"use client"

import { useEffect, useMemo, useState } from "react"
import { useLanguage } from "@/lib/language-context"
import { useCart } from "@/lib/cart-context"
import { useToast } from "@/hooks/use-toast"
import MediaGallery from "./MediaGallery"
import VariantDropdowns from "./VariantDropdowns"
import ChipVariantGroup from "./ChipVariantGroup"
import FileUploadZone, { type UploadedFile } from "./FileUploadZone"
import QuantityStepper from "./QuantityStepper"
import ProductTabs from "./ProductTabs"
import PriceDisplay from "./PriceDisplay"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Heart, Share2, ShoppingCart, FileText } from "lucide-react"
import { useRouter } from "next/navigation"

export type ProductVariantOption = {
  id: string
  label: string
  price_modifier: number
  tier_pricing?: any | null
  is_available: boolean
  sortOrder: number
}

export type ProductVariantGroup = {
  id: string
  name: string
  display: "dropdown" | "chips"
  sortOrder: number
  options: ProductVariantOption[]
}

export type ProductDetail = {
  id: string
  name: string
  shortDescription: string | null
  description: string | null
  price: number
  wholesaleTiers?: any | null
  priceDisclaimer?: string | null
  acceptsUploads: boolean
  isCustomizable: boolean
  isQuotable: boolean
  specifications: any | null
  shippingInfo: string | null
}

type PricingTier = {
  quantity: number
  maxQuantity?: number
  price: number
}

function normalizeTiers(raw: any): PricingTier[] {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as any).tiers) ? (raw as any).tiers : raw
  if (!Array.isArray(src)) return []
  return (src as any[])
    .map((t) => ({
      quantity: Number.parseInt(String(t?.quantity ?? t?.qty ?? ""), 10),
      maxQuantity: Number.isFinite(Number.parseInt(String(t?.maxQuantity ?? t?.max_quantity ?? ""), 10))
        ? Number.parseInt(String(t?.maxQuantity ?? t?.max_quantity ?? ""), 10)
        : undefined,
      price: Number.parseFloat(String(t?.price ?? "")),
    }))
    .filter((t) => Number.isFinite(t.quantity) && t.quantity > 0 && Number.isFinite(t.price) && t.price >= 0)
    .sort((a, b) => a.quantity - b.quantity)
}

function getTierMode(raw: any, tiers: PricingTier[]): "range" | "quantity" {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as any).tier_mode === "range") return "range"
  return tiers.some((t) => typeof t.maxQuantity === "number" && Number.isFinite(t.maxQuantity)) ? "range" : "quantity"
}

function findTierForQuantity(tiers: PricingTier[], qty: number): PricingTier | null {
  if (!tiers.length) return null
  const sorted = tiers.slice().sort((a, b) => a.quantity - b.quantity)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i]
    if (qty < t.quantity) continue
    if (t.maxQuantity != null && Number.isFinite(t.maxQuantity) && qty > t.maxQuantity) continue
    return t
  }
  return null
}

export type ProductMedia = {
  id: string
  url: string
  type: "image" | "video"
  alt: string
  sortOrder: number
}

type VariantPriceMode = "add" | "override"

function resolvePrice(
  basePrice: number,
  variantGroups: ProductVariantGroup[],
  selectedOptions: Record<string, string>,
  mode: VariantPriceMode,
): number {
  if (mode === "add") {
    return variantGroups.reduce((price, group) => {
      const selectedOptionId = selectedOptions[group.id]
      const option = group.options.find((o) => o.id === selectedOptionId)
      return price + (option?.price_modifier ?? 0)
    }, basePrice)
  }

  const selectedPrices = variantGroups
    .map((group) => {
      const selectedOptionId = selectedOptions[group.id]
      const option = group.options.find((o) => o.id === selectedOptionId)
      return option?.price_modifier
    })
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))

  if (selectedPrices.length === 0) return basePrice
  return Math.max(...selectedPrices)
}

function getModifierForQty(option: ProductVariantOption | undefined, qty: number | null): number | null {
  if (!option) return null
  if (qty == null) return option.price_modifier ?? 0
  const tiers = normalizeTiers(option.tier_pricing)
  if (tiers.length === 0) return (option.price_modifier ?? 0) * qty
  const match = findTierForQuantity(tiers, qty)
  if (!match) return null
  const mode = getTierMode(option.tier_pricing, tiers)
  return mode === "range" ? match.price * qty : match.price
}

function resolvePriceForQty(
  variantGroups: ProductVariantGroup[],
  selectedOptions: Record<string, string>,
  mode: VariantPriceMode,
  qty: number,
): number {
  if (mode === "add") {
    return variantGroups.reduce((sum, group) => {
      const selectedOptionId = selectedOptions[group.id]
      const option = group.options.find((o) => o.id === selectedOptionId)
      return sum + (getModifierForQty(option, qty) ?? 0)
    }, 0)
  }

  const selectedPrices = variantGroups
    .map((group) => {
      const selectedOptionId = selectedOptions[group.id]
      const option = group.options.find((o) => o.id === selectedOptionId)
      return getModifierForQty(option, qty)
    })
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))

  if (selectedPrices.length === 0) return 0
  return Math.max(...selectedPrices)
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function ProductDetailClient({
  product,
  media,
  variantGroups,
}: {
  product: ProductDetail
  media: ProductMedia[]
  variantGroups: ProductVariantGroup[]
}) {
  const { t } = useLanguage()
  const { addItem } = useCart()
  const { toast } = useToast()
  const router = useRouter()

  const [sessionId] = useState(() => generateSessionId())

  const initialSelections = useMemo(() => {
    const selections: Record<string, string> = {}
    variantGroups.forEach((group) => {
      const firstAvailable = group.options.find((o) => o.is_available) || group.options[0]
      if (firstAvailable) selections[group.id] = firstAvailable.id
    })
    return selections
  }, [variantGroups])

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialSelections)
  const [quantity, setQuantity] = useState(1)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [designUrl, setDesignUrl] = useState("")
  const [designUrlError, setDesignUrlError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const dropdownGroups = useMemo(() => variantGroups.filter((g) => g.display === "dropdown"), [variantGroups])
  const chipGroup = useMemo(() => variantGroups.find((g) => g.display === "chips") || null, [variantGroups])

  const variantPriceMode: VariantPriceMode = useMemo(() => {
    const raw = product.wholesaleTiers
    if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as any).variant_price_mode === "override") return "override"
    return "add"
  }, [product.wholesaleTiers])

  const variantTierStack = useMemo(() => {
    const raw = product.wholesaleTiers
    return !!(raw && typeof raw === "object" && !Array.isArray(raw) && (raw as any).variant_tier_stack === true)
  }, [product.wholesaleTiers])

  const variantTierQuantities = useMemo(() => {
    const qtySet = new Set<number>()
    variantGroups.forEach((group) => {
      const selectedOptionId = selectedOptions[group.id]
      const option = group.options.find((o) => o.id === selectedOptionId)
      const tiers = normalizeTiers(option?.tier_pricing)
      const mode = getTierMode(option?.tier_pricing, tiers)
      if (mode === "range") return
      tiers.forEach((t) => qtySet.add(t.quantity))
    })
    return Array.from(qtySet).sort((a, b) => a - b)
  }, [variantGroups, selectedOptions])

  const legacyTiers = useMemo(() => normalizeTiers(product.wholesaleTiers), [product.wholesaleTiers])

  const rangeTierMode = useMemo(() => {
    const raw = product.wholesaleTiers
    if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as any).tier_mode === "range") return true
    if (legacyTiers.some((t) => typeof t.maxQuantity === "number" && Number.isFinite(t.maxQuantity))) return true
    for (const group of variantGroups) {
      const selectedOptionId = selectedOptions[group.id]
      const option = group.options.find((o) => o.id === selectedOptionId)
      const tiers = normalizeTiers(option?.tier_pricing)
      const mode = getTierMode(option?.tier_pricing, tiers)
      if (mode === "range" && tiers.length > 0) return true
    }
    return false
  }, [product.wholesaleTiers, legacyTiers, variantGroups, selectedOptions])

  const tierQuantities = useMemo(() => {
    if (rangeTierMode) return []
    if (variantTierQuantities.length > 0) return variantTierQuantities
    return legacyTiers.map((t) => t.quantity)
  }, [rangeTierMode, variantTierQuantities, legacyTiers])

  const discreteTierMode = tierQuantities.length > 0
  const tierMode = rangeTierMode || discreteTierMode
  const [selectedTierQty, setSelectedTierQty] = useState(() => tierQuantities[0] ?? 1)

  useEffect(() => {
    if (!discreteTierMode) return
    if (tierQuantities.length === 0) return
    if (tierQuantities.includes(selectedTierQty)) return
    setSelectedTierQty(tierQuantities[0])
  }, [discreteTierMode, tierQuantities, selectedTierQty])

  const computeTierTotal = useMemo(() => {
    return (qty: number) => {
      const selectedOptionsList = variantGroups
        .map((group) => {
          const selectedOptionId = selectedOptions[group.id]
          return group.options.find((o) => o.id === selectedOptionId)
        })
        .filter((o): o is ProductVariantOption => !!o)

      if (variantTierStack) {
        const tierTotals = selectedOptionsList
          .filter((o) => normalizeTiers(o.tier_pricing).length > 0)
          .map((o) => getModifierForQty(o, qty))
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v))

        if (tierTotals.length > 0) {
          const base = variantPriceMode === "add" ? tierTotals.reduce((a, b) => a + b, 0) : Math.max(...tierTotals)
          const modifiers = selectedOptionsList
            .filter((o) => normalizeTiers(o.tier_pricing).length === 0)
            .reduce((sum, o) => sum + (o.price_modifier ?? 0) * qty, 0)
          return base + modifiers
        }
      }

      const tier = findTierForQuantity(legacyTiers, qty)
      const productRange = getTierMode(product.wholesaleTiers, legacyTiers) === "range"
      const baseTotal = tier ? (productRange ? tier.price * qty : tier.price) : product.price * qty

      const variantTotal =
        variantTierQuantities.length > 0 || variantGroups.some((g) => normalizeTiers(g.options.find((o) => o.id === selectedOptions[g.id])?.tier_pricing).length > 0)
          ? resolvePriceForQty(variantGroups, selectedOptions, variantPriceMode, qty)
          : (() => {
              const mods = variantGroups
                .map((group) => {
                  const selectedOptionId = selectedOptions[group.id]
                  const option = group.options.find((o) => o.id === selectedOptionId)
                  return option?.price_modifier ?? 0
                })
                .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
              if (variantPriceMode === "add") return mods.reduce((a, b) => a + b, 0)
              return mods.length ? Math.max(...mods) : 0
            })()

      if (variantPriceMode === "add") return baseTotal + variantTotal
      return variantTotal ? variantTotal : baseTotal
    }
  }, [
    variantTierStack,
    variantTierQuantities.length,
    variantGroups,
    selectedOptions,
    variantPriceMode,
    legacyTiers,
    product.price,
    product.wholesaleTiers,
  ])

  const effectiveQuantity = rangeTierMode ? quantity : discreteTierMode ? selectedTierQty : quantity

  const totalPrice = useMemo(() => {
    if (tierMode) return computeTierTotal(effectiveQuantity)
    const unit = resolvePrice(product.price, variantGroups, selectedOptions, variantPriceMode)
    return unit * quantity
  }, [tierMode, computeTierTotal, effectiveQuantity, product.price, variantGroups, selectedOptions, variantPriceMode, quantity])

  const unitPrice = useMemo(() => {
    if (tierMode) return null
    return resolvePrice(product.price, variantGroups, selectedOptions, variantPriceMode)
  }, [tierMode, product.price, variantGroups, selectedOptions, variantPriceMode])

  const unitPriceForCart = useMemo(() => {
    if (!tierMode) return unitPrice as number
    if (!effectiveQuantity) return 0
    return totalPrice / effectiveQuantity
  }, [tierMode, unitPrice, totalPrice, effectiveQuantity])

  const mainMediaUrl = media[0]?.url || "/placeholder.svg"

  const validateDesignUrl = (value: string) => {
    const v = value.trim()
    if (!v) return null
    try {
      new URL(v)
      return null
    } catch {
      return t("product.design_url_invalid")
    }
  }

  const handleAddToCart = async () => {
    const urlError = validateDesignUrl(designUrl)
    setDesignUrlError(urlError)
    if (urlError) return

    setIsAdding(true)
    try {
      const doneUploads = uploadedFiles.filter((f) => f.status === "done" && f.storagePath)
      const variantModifiers = variantGroups
        .map((group) => {
          const selectedOptionId = selectedOptions[group.id]
          const option = group.options.find((o) => o.id === selectedOptionId)
          return option?.price_modifier
        })
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      addItem({
        productId: product.id,
        quantity: effectiveQuantity,
        price: unitPriceForCart,
        name: product.name,
        image: mainMediaUrl,
        customizations: {
          selectedOptions,
          tier: tierMode
            ? {
                mode: rangeTierMode ? "range" : "quantity",
                quantity: effectiveQuantity,
                price: totalPrice,
                ...(rangeTierMode
                  ? {
                      wholesaleTiers: product.wholesaleTiers ?? null,
                      basePrice: product.price,
                      variantPriceMode,
                      variantModifiers,
                    }
                  : {}),
              }
            : null,
          uploadedFiles: doneUploads.map((f) => ({
            id: f.orderFileId,
            path: f.storagePath,
            publicUrl: f.publicUrl,
            name: f.name,
            size: f.size,
          })),
          designUrl: designUrl.trim() || null,
          notes: notes.trim() || null,
        },
      })

      toast({ title: t("product.added_to_cart") })
      setUploadedFiles([])
      setDesignUrl("")
      setNotes("")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <MediaGallery items={media} />

        <div className="space-y-5">
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>

          {product.isQuotable ? (
            <p className="text-sm text-gray-700">{t("productDetail.quoteOnlyNotice")}</p>
          ) : (
            <PriceDisplay
              totalPrice={totalPrice}
              unitPrice={unitPrice}
              contextLine={tierMode ? `${t("product.quantity_label")}: ${effectiveQuantity}` : null}
              disclaimer={product.priceDisclaimer ?? null}
            />
          )}

          {!product.isQuotable && discreteTierMode ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">{t("product.quantity_label")}</label>
              <Select value={String(selectedTierQty)} onValueChange={(val) => setSelectedTierQty(Number.parseInt(val, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tierQuantities.map((q) => (
                    <SelectItem key={q} value={String(q)}>
                      {q} · ${computeTierTotal(q).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {!product.isQuotable && dropdownGroups.length > 0 && (
            <VariantDropdowns
              groups={dropdownGroups}
              selectedOptions={selectedOptions}
              onChange={(groupId, optionId) => setSelectedOptions((prev) => ({ ...prev, [groupId]: optionId }))}
            />
          )}

          {product.shortDescription ? <p className="text-gray-700">{product.shortDescription}</p> : null}

          {!product.isQuotable ? <div className="space-y-4">
            <FileUploadZone sessionId={sessionId} files={uploadedFiles} onChange={setUploadedFiles} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">{t("product.design_url_label")}</label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                placeholder={t("product.design_url_placeholder")}
                value={designUrl}
                onChange={(e) => setDesignUrl(e.target.value)}
                onBlur={() => setDesignUrlError(validateDesignUrl(designUrl))}
              />
              {designUrlError ? <p className="text-sm text-red-600">{designUrlError}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">{t("product.notes_label")}</label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background resize-y"
                rows={4}
                placeholder={t("product.notes_placeholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div> : null}

          {!product.isQuotable && chipGroup ? (
            <ChipVariantGroup
              group={chipGroup}
              selectedOptionId={selectedOptions[chipGroup.id]}
              onSelect={(optionId) => setSelectedOptions((prev) => ({ ...prev, [chipGroup.id]: optionId }))}
            />
          ) : null}

          {!product.isQuotable && !discreteTierMode ? <QuantityStepper value={quantity} onChange={setQuantity} /> : null}

          {product.isQuotable ? (
            <Button className="w-full bg-[#8B0000] hover:bg-[#6B0000]" onClick={() => router.push(`/quote?productId=${product.id}`)}>
              <FileText className="mr-2 h-4 w-4" />
              {t("common.quote")}
            </Button>
          ) : (
            <Button className="w-full bg-[#8B0000] hover:bg-[#6B0000]" onClick={handleAddToCart} disabled={isAdding}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              {t("product.cta_add_to_cart")}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button">
              <Heart className="mr-2 h-4 w-4" />
              {t("product.save")}
            </Button>
            <Button variant="outline" type="button">
              <Share2 className="mr-2 h-4 w-4" />
              {t("product.share")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <ProductTabs
          description={product.description}
          specifications={product.specifications}
          shippingInfo={product.shippingInfo}
          isCustomizable={product.isCustomizable}
          productId={product.id}
          productName={product.name}
            productPrice={unitPriceForCart}
          productImage={mainMediaUrl}
        />
      </div>
    </div>
  )
}
