import { notFound } from "next/navigation"
import { supabaseServer } from "@/lib/supabase-server"
import ProductDetailClient from "./ProductDetailClient"

type ProductMediaRow = {
  id: string
  storage_path: string
  type: "image" | "video"
  alt_text: string | null
  sort_order: number | null
}

type VariantOptionRow = {
  id: string
  label: string
  price_modifier: number
  is_available: boolean | null
  sort_order: number | null
}

type VariantGroupRow = {
  id: string
  name: string
  display: "dropdown" | "chips"
  sort_order: number | null
  product_variant_options: VariantOptionRow[] | null
}

type ProductRow = {
  id: string
  name: string
  image: string | null
  short_description: string | null
  description: string | null
  price: number
  accepts_uploads: boolean | null
  is_customizable: boolean | null
  specifications: any | null
  shipping_info: string | null
  product_media: ProductMediaRow[] | null
  product_variant_groups: VariantGroupRow[] | null
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const { data: product, error } = await supabaseServer
    .from("products")
    .select(
      `
      id,
      name,
      image,
      short_description,
      description,
      price,
      accepts_uploads,
      is_customizable,
      specifications,
      shipping_info,
      product_media ( id, storage_path, type, alt_text, sort_order ),
      product_variant_groups (
        id,
        name,
        display,
        sort_order,
        product_variant_options ( id, label, price_modifier, is_available, sort_order )
      )
    `,
    )
    .eq("id", params.id)
    .single<ProductRow>()

  if (error || !product) notFound()

  let signedMedia = await Promise.all(
    (product.product_media || [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(async (item) => {
        const { data } = await supabaseServer.storage.from("product-media").createSignedUrl(item.storage_path, 3600)
        return {
          id: item.id,
          url: data?.signedUrl ?? "",
          type: item.type,
          alt: item.alt_text || product.name,
          sortOrder: item.sort_order ?? 0,
        }
      }),
  )

  if (signedMedia.length === 0 && product.image) {
    signedMedia = [
      {
        id: "legacy-image",
        url: product.image,
        type: "image" as const,
        alt: product.name,
        sortOrder: 0,
      },
    ]
  }

  const variantGroups = (product.product_variant_groups || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((g) => ({
      id: g.id,
      name: g.name,
      display: g.display,
      sortOrder: g.sort_order ?? 0,
      options: (g.product_variant_options || [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((o) => ({
          id: o.id,
          label: o.label,
          price_modifier: Number(o.price_modifier ?? 0),
          is_available: o.is_available ?? true,
          sortOrder: o.sort_order ?? 0,
        })),
    }))

  return (
    <ProductDetailClient
      product={{
        id: product.id,
        name: product.name,
        shortDescription: product.short_description,
        description: product.description,
        price: Number(product.price ?? 0),
        acceptsUploads: product.accepts_uploads ?? true,
        isCustomizable: product.is_customizable ?? false,
        specifications: product.specifications,
        shippingInfo: product.shipping_info,
      }}
      media={signedMedia}
      variantGroups={variantGroups}
    />
  )
}
