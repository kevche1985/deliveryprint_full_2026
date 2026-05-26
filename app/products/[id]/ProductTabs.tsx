"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/language-context"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

type SpecItem = { key: string; value: string }

function normalizeSpecs(specifications: any): SpecItem[] {
  if (!Array.isArray(specifications)) return []
  return specifications
    .map((s) => {
      if (!s || typeof s !== "object") return null
      const key = typeof s.key === "string" ? s.key : null
      const value = typeof s.value === "string" ? s.value : null
      if (!key || !value) return null
      return { key, value }
    })
    .filter((x): x is SpecItem => !!x)
}

const DesignEditor = dynamic(() => import("@/components/design-editor").catch(() => import("@/components/design-editor-fallback")), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E84E3A] mx-auto mb-2" />
        <p className="text-sm text-gray-600">Loading Design Editor...</p>
      </div>
    </div>
  ),
})

export default function ProductTabs({
  description,
  specifications,
  shippingInfo,
  isCustomizable,
  productId,
  productName,
  productPrice,
  productImage,
}: {
  description: string | null
  specifications: any | null
  shippingInfo: string | null
  isCustomizable: boolean
  productId: string
  productName: string
  productPrice: number
  productImage: string | null
}) {
  const { t } = useLanguage()
  const specs = normalizeSpecs(specifications)

  return (
    <Tabs defaultValue="details" className="pt-2">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="details">{t("product.tab_details")}</TabsTrigger>
        {isCustomizable ? <TabsTrigger value="customize">{t("product.tab_customize")}</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="details" className="pt-4">
        {description ? <p className="mb-6 text-sm text-gray-700 whitespace-pre-line">{description}</p> : null}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">{t("product.specs_heading")}</p>
            {specs.length > 0 ? (
              <dl className="space-y-2">
                {specs.map((s) => (
                  <div key={s.key} className="flex items-start justify-between gap-4">
                    <dt className="text-sm text-gray-600">{s.key}</dt>
                    <dd className="text-sm text-gray-900 text-right">{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500">—</p>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">{t("product.shipping_heading")}</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{shippingInfo || "—"}</p>
          </div>
        </div>
      </TabsContent>

      {isCustomizable ? (
        <TabsContent value="customize" className="pt-4">
          <div className="space-y-4">
            <DesignEditor productImage={productImage || undefined} product={{ id: productId, name: productName, price: productPrice }} />
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link href={`/ai-studio?productId=${encodeURIComponent(productId)}`}>{t("product.customize_cta")}</Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
