export interface ServiceImage {
  id: string
  serviceId: string
  storagePath: string
  url: string
  altText?: string
  sortOrder: number
  isPrimary: boolean
}

export interface ServiceVariantOption {
  id: string
  variantId: string
  label: string
  priceDelta: number
  skuSuffix?: string
  sortOrder: number
  isActive: boolean
}

export interface ServiceVariant {
  id: string
  serviceId: string
  name: string
  sortOrder: number
  options: ServiceVariantOption[]
}

export interface ServiceEditorState {
  name: string
  description: string
  startingPrice: number
  category: string
  slug: string
  isActive: boolean
  isFeatured: boolean
  images: ServiceImage[]
  variants: ServiceVariant[]
}
