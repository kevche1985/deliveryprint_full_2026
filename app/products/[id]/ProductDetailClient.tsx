"use client"

import { useMemo, useState } from "react"
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
import { Heart, Share2, ShoppingCart } from "lucide-react"

export type ProductVariantOption = {
  id: string
  label: string
  price_modifier: number
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
  acceptsUploads: boolean
  isCustomizable: boolean
  specifications: any | null
  shippingInfo: string | null
}

export type ProductMedia = {
  id: string
  url: string
  type: "image" | "video"
  alt: string
  sortOrder: number
}

function resolvePrice(basePrice: number, variantGroups: ProductVariantGroup[], selectedOptions: Record<string, string>): number {
  return variantGroups.reduce((price, group) => {
    const selectedOptionId = selectedOptions[group.id]
    const option = group.options.find((o) => o.id === selectedOptionId)
    return price + (option?.price_modifier ?? 0)
  }, basePrice)
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

  const resolvedPrice = useMemo(
    () => resolvePrice(product.price, variantGroups, selectedOptions),
    [product.price, selectedOptions, variantGroups],
  )

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
      addItem({
        productId: product.id,
        quantity,
        price: resolvedPrice,
        name: product.name,
        image: mainMediaUrl,
        customizations: {
          selectedOptions,
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
          <h1 className="font-serif text-3xl text-gray-900">{product.name}</h1>

          <PriceDisplay price={resolvedPrice} />

          {dropdownGroups.length > 0 && (
            <VariantDropdowns
              groups={dropdownGroups}
              selectedOptions={selectedOptions}
              onChange={(groupId, optionId) => setSelectedOptions((prev) => ({ ...prev, [groupId]: optionId }))}
            />
          )}

          {product.shortDescription ? <p className="text-gray-700">{product.shortDescription}</p> : null}

          <div className="space-y-4">
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
          </div>

          {chipGroup ? (
            <ChipVariantGroup
              group={chipGroup}
              selectedOptionId={selectedOptions[chipGroup.id]}
              onSelect={(optionId) => setSelectedOptions((prev) => ({ ...prev, [chipGroup.id]: optionId }))}
            />
          ) : null}

          <QuantityStepper value={quantity} onChange={setQuantity} />

          <Button className="w-full bg-[#E84E3A] hover:bg-[#d94634]" onClick={handleAddToCart} disabled={isAdding}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t("product.cta_add_to_cart")}
          </Button>

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
          productPrice={resolvedPrice}
          productImage={mainMediaUrl}
        />
      </div>
    </div>
  )
}
