// Image utility functions for the application
import { OrderItem } from '@/lib/database'

export function getImageUrl(path: string | null | undefined): string {
  if (!path) return '/placeholder.svg'

  // If it's already a full URL (any host), use as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Normalize double slashes in Supabase public object URLs
    try {
      const u = new URL(path)
      const marker = '/storage/v1/object/public/'
      const idx = u.pathname.indexOf(marker)
      if (idx >= 0) {
        const suffix = u.pathname.slice(idx + marker.length)
        const normalized = suffix.replace(/^\/+/, '').replace(/\/{2,}/g, '/')
        return `${u.origin}${marker}${normalized}`
      }
    } catch {
      // fall through
    }
    return path
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const clean = (path.startsWith('/') ? path.slice(1) : path).replace(/\/{2,}/g, '/')
  return `${base}/storage/v1/object/public/${clean}`
}

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const maxSize = 5 * 1024 * 1024 // 5MB
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
    }
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Please upload an image smaller than 5MB.'
    }
  }
  
  return { isValid: true }
}

// Order item image utility functions
export function getOrderItemImageUrl(item: OrderItem): string {
  // Priority order for image selection
  const imageUrl = 
    item.customized_image_url ||     // Customized product (highest priority)
    item.design_image_url ||         // Design preview
    item.product_image_url ||        // Base product image
    (item.products as any)?.image || // Product table image
    '/placeholder-product.svg'       // Fallback placeholder
  
  return getImageUrl(imageUrl)
}

export function getOperatorPrintImage(item: OrderItem): string {
  // For operators - prioritize print-ready files
  const printUrl = (
    item.print_ready_file_url ||
    item.design_file_url ||
    item.customized_image_url ||
    item.design_image_url ||
    '/placeholder-print.svg'
  )
  
  return getImageUrl(printUrl)
}

export function validateImageUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function getImageTypeLabel(item: OrderItem): string | null {
  if (item.customized_image_url) return 'Custom'
  if (item.design_image_url && !item.customized_image_url) return 'Design'
  if (item.digital_product_id) return 'Digital'
  return null
}

export function hasValidImage(item: OrderItem): boolean {
  return !!(item.customized_image_url || item.design_image_url || item.product_image_url || (item.products as any)?.image)
}

export function hasPrintFiles(item: OrderItem): boolean {
  return !!(item.print_ready_file_url || item.design_file_url)
}

// Legacy functions - kept for backward compatibility
export function getOrderItemDisplayImage(item: OrderItem): string | null {
  // Priority: customized product image > design image > product image
  if (item.customized_image_url) {
    return item.customized_image_url
  }
  
  if (item.design_image_url) {
    return item.design_image_url
  }
  
  if (item.product_image_url) {
    return item.product_image_url
  }
  
  return null
}

export function getOrderItemDownloadUrl(item: OrderItem): string | null {
  // Priority: design file > customized product image > design image
  if (item.design_file_url) {
    return item.design_file_url
  }
  
  if (item.customized_image_url) {
    return item.customized_image_url
  }
  
  if (item.design_image_url) {
    return item.design_image_url
  }
  
  return null
}
