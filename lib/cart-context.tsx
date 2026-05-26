"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"

// Define cart item type
export type CartItem = {
  id: string // Unique cart item ID
  productId: string
  variantId?: string
  designId?: string
  configKey?: string
  quantity: number
  price: number
  name: string
  image: string // Now always a URL (either product image URL or Supabase Storage URL)
  customizations?: any // Design data or customizations
}

// Define cart context type
type CartContextType = {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addItem: (item: Omit<CartItem, "id">) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

// Create the context
const CartContext = createContext<CartContextType | undefined>(undefined)

// Generate a unique ID for cart items
const generateId = () => Math.random().toString(36).substring(2, 9)

const stableStringify = (value: any) => {
  try {
    const seen = new WeakSet()
    return JSON.stringify(value, (k, v) => {
      if (v && typeof v === "object") {
        if (seen.has(v)) return undefined
        seen.add(v)
        if (Array.isArray(v)) return v
        return Object.keys(v)
          .sort()
          .reduce((acc: any, key) => {
            acc[key] = v[key]
            return acc
          }, {})
      }
      return v
    })
  } catch {
    return ""
  }
}

const computeConfigKey = (item: Omit<CartItem, "id">) => {
  if (item.configKey) return item.configKey
  const c = item.customizations || {}
  const selectedOptions = c?.selectedOptions || null
  const designUrl = c?.designUrl || null
  const notes = c?.notes || null
  const uploadedFiles = Array.isArray(c?.uploadedFiles) ? c.uploadedFiles.map((f: any) => f?.id || f?.path || f?.publicUrl || null) : null
  return stableStringify({ selectedOptions, designUrl, notes, uploadedFiles })
}

// Provider component
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [itemCount, setItemCount] = useState(0)
  const [subtotal, setSubtotal] = useState(0)
  const { user } = useAuth()
  const storageKey = user?.id ? `cart:${user.id}` : "cart:guest"

  // Load cart from localStorage on user change
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setItems(parsed)
          return
        }
      }
      setItems([])
    } catch (e) {
      console.error("Failed to load cart:", e)
      try {
        localStorage.removeItem(storageKey)
      } catch {}
      setItems([])
    }
  }, [storageKey])

  // Update localStorage and calculations when items change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(items))
        setItemCount(items.reduce((total, item) => total + item.quantity, 0))
        setSubtotal(items.reduce((total, item) => total + item.price * item.quantity, 0))
      } catch (error: any) {
        console.error("Failed to update cart in localStorage:", error)
        if (error.name === "QuotaExceededError" || (error.message && error.message.includes("exceeded the quota"))) {
          alert("Your cart is too large to be saved locally. Please proceed to checkout or remove some items.")
        }
      }
    }
  }, [items, storageKey])

  // Add an item to the cart
  const addItem = (item: Omit<CartItem, "id">) => {
    try {
      const configKey = computeConfigKey(item)
      console.log("Adding item to cart:", {
        name: item.name,
        image: item.image,
        isCustomDesign: item.customizations?.is_custom_design,
        designId: item.designId,
      })

      const existingItemIndex = items.findIndex(
        (i) =>
          i.productId === item.productId &&
          i.variantId === item.variantId &&
          i.designId === item.designId &&
          (i.configKey || "") === configKey,
      )

      if (existingItemIndex !== -1) {
        const updatedItems = [...items]
        updatedItems[existingItemIndex].quantity += item.quantity
        setItems(updatedItems)
        console.log("Cart updated:", item.name)
      } else {
        setItems([...items, { ...item, configKey, id: generateId() }])
        console.log("Added to cart:", item.name)
      }
    } catch (error) {
      console.error("Failed to add item to cart:", error)
    }
  }

  // Update the quantity of an item
  const updateQuantity = (id: string, quantity: number) => {
    try {
      if (quantity < 1) return
      setItems(items.map((item) => (item.id === id ? { ...item, quantity } : item)))
    } catch (error) {
      console.error("Failed to update quantity:", error)
    }
  }

  // Remove an item from the cart
  const removeItem = (id: string) => {
    try {
      const itemToRemove = items.find((item) => item.id === id)
      setItems(items.filter((item) => item.id !== id))
      if (itemToRemove) {
        console.log("Removed from cart:", itemToRemove.name)
      }
    } catch (error) {
      console.error("Failed to remove item:", error)
    }
  }

  // Clear the cart
  const clearCart = () => {
    try {
      setItems([])
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(storageKey)
        } catch {}
        try {
          localStorage.removeItem("cart")
        } catch {}
        try {
          localStorage.removeItem("cart:guest")
        } catch {}
        try {
          const keysToRemove: string[] = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key) continue
            if (key.startsWith("cart:")) keysToRemove.push(key)
          }
          keysToRemove.forEach((k) => {
            try {
              localStorage.removeItem(k)
            } catch {}
          })
        } catch {}
      }
      console.log("Cart cleared")
    } catch (error) {
      console.error("Failed to clear cart:", error)
    }
  }

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

// Custom hook to use the cart context
export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
