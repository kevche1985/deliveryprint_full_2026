import { type NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { updateOrderPaymentStatus } from "@/lib/database" // Assuming these are server-side functions
import { sendOrderConfirmationEmail } from "@/lib/email-service" // Assuming this exists
import { markDigitalProductAsPurchased } from "@/lib/digital-product-service"

export async function POST(req: NextRequest) {
  try {
    const {
      orderId,
      paymentMethod,
      transactionId,
      paymentStatus,
      cartItems,
      digitalCartItems,
      customerEmail,
      shippingAddress,
      notes,
      shippingMethod,
      total,
      subtotal,
      tax,
      shipping,
      userId,
    } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Note: We don't require user authentication here because:
    // 1. Payment has already been validated by PayPal/payment provider
    // 2. User session may not be available after payment redirect
    // 3. We have orderId and transactionId for verification
    console.log('Processing payment confirmation for order:', orderId, 'transaction:', transactionId)
    
    // Optional: Verify the order exists and belongs to the provided userId if available
    if (userId) {
      const { data: existingOrder, error: orderError } = await supabaseServer
        .from('orders')
        .select('id, user_id')
        .eq('id', orderId)
        .single()
      
      if (orderError || !existingOrder) {
        console.error('Order not found:', orderId, orderError)
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }
      
      if (existingOrder.user_id !== userId) {
        console.error('Order user mismatch:', existingOrder.user_id, 'vs', userId)
        return NextResponse.json({ error: "Order access denied" }, { status: 403 })
      }
    }

    const { data: orderRow, error: orderFetchErr } = await supabaseServer
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single()
    if (orderFetchErr || !orderRow) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // 1. Update the order status on the server using service role
    const paymentStatusValue = paymentStatus || 'completed'
    const { data: updatedOrder, error: updateErr } = await supabaseServer
      .from('orders')
      .update({ status: paymentStatusValue, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single()
    if (updateErr || !updatedOrder) {
      console.error("Error updating order payment status:", updateErr)
      return NextResponse.json({ error: "Failed to update order payment status" }, { status: 500 })
    }

    const legacyBucket = "digital-products"
    const orderFilesBucket = "order_files"

    const extractPathFromPublicUrl = (publicUrl: string | null | undefined, bucket: string) => {
      if (!publicUrl) return null
      const marker = "/storage/v1/object/public/"
      const idx = publicUrl.indexOf(marker)
      if (idx === -1) return null
      const rest = publicUrl.slice(idx + marker.length)
      if (!rest.startsWith(`${bucket}/`)) return null
      return rest.slice(bucket.length + 1)
    }

    const promoteOrderFileIfNeeded = async (args: {
      orderFileId: string
      orderItemId: string
    }) => {
      const { orderFileId, orderItemId } = args
      const { data: fileRow } = await (supabaseServer as any)
        .from("order_files")
        .select("id, status, storage_bucket, storage_path, file_url, file_name")
        .eq("id", orderFileId)
        .single()
      if (!fileRow) return null

      const bucket = fileRow.storage_bucket || orderFilesBucket
      const currentPath = fileRow.storage_path as string | null
      const currentUrl = fileRow.file_url as string | null

      if (fileRow.status === "permanent") {
        if (currentUrl) {
          await supabaseServer
            .from("order_items")
            .update({
              design_image_url: currentUrl,
              design_file_url: currentUrl,
              print_ready_file_url: currentUrl,
            })
            .eq("id", orderItemId)
        }
        return fileRow
      }

      if (!currentPath || !currentPath.includes("uploads/temp/")) return fileRow

      const fileName = currentPath.split("/").pop()!
      const permanentPath = `uploads/orders/${orderId}/${orderItemId}/${fileName}`

      await supabaseServer.storage.from(bucket).copy(currentPath, permanentPath)
      await supabaseServer.storage.from(bucket).remove([currentPath])

      const { data: pub } = supabaseServer.storage.from(bucket).getPublicUrl(permanentPath)
      const publicUrl = pub?.publicUrl || null
      if (!publicUrl) return fileRow

      await (supabaseServer as any)
        .from("order_files")
        .update({
          order_id: orderId,
          order_item_id: orderItemId,
          status: "permanent",
          storage_path: permanentPath,
          storage_bucket: bucket,
          file_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderFileId)

      await supabaseServer
        .from("order_items")
        .update({
          design_image_url: publicUrl,
          design_file_url: publicUrl,
          print_ready_file_url: publicUrl,
        })
        .eq("id", orderItemId)

      return { ...fileRow, status: "permanent", storage_path: permanentPath, file_url: publicUrl }
    }

    const { data: existingItems } = await supabaseServer
      .from('order_items')
      .select('id,name,design_file_url,design_image_url,print_ready_file_url,customizations,digital_product_id,product_id')
      .eq('order_id', orderId)
    if ((!existingItems || existingItems.length === 0) && Array.isArray(cartItems) && cartItems.length > 0) {
      for (const item of cartItems) {
        const lightweightCustomizations = item.customizations ? JSON.parse(JSON.stringify(item.customizations)) : null

        let designImageUrl = item.design_image_url || item.customizations?.preview_url || null
        let designFileUrl = item.design_file_url || item.customizations?.download_url || null
        const customizedProductImageUrl = item.customizedProductImage || item.customizations?.customizedProductImage || null

        const uploaded = item.customizations?.uploadedFiles && item.customizations.uploadedFiles[0]
        const uploadedPublic = uploaded?.publicUrl || null
        const uploadedPath = (uploaded?.path as string | undefined) || null
        const uploadedId = (uploaded?.id as string | undefined) || null
        if (uploadedPublic) designFileUrl = uploadedPublic

        if (!uploadedId) {
          try {
            const tempPath = uploadedPath || extractPathFromPublicUrl(designFileUrl, legacyBucket)
            if (tempPath && tempPath.includes("uploads/temp/")) {
              const fileName = tempPath.split("/").pop()!
              const orderPath = `uploads/orders/${orderId}/${fileName}`
              await supabaseServer.storage.from(legacyBucket).copy(tempPath, orderPath)
              await supabaseServer.storage.from(legacyBucket).remove([tempPath])
              const { data: pub } = supabaseServer.storage.from(legacyBucket).getPublicUrl(orderPath)
              if (pub?.publicUrl) {
                designFileUrl = pub.publicUrl
                if (!designImageUrl) designImageUrl = pub.publicUrl
              }
            }
          } catch {}
        }

        if (!designImageUrl) designImageUrl = customizedProductImageUrl || item.productImage || item.preview_url || null
        if (!designFileUrl) designFileUrl = customizedProductImageUrl || item.download_url || designImageUrl || null

        const orderItem = {
          order_id: orderId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          design_id: item.designId || null,
          quantity: item.quantity || 1,
          price: item.price || 0,
          name: item.name,
          product_image_url: item.productImage || null,
          design_image_url: designImageUrl || null,
          design_file_url: designFileUrl || null,
          customized_image_url: customizedProductImageUrl || null,
          print_ready_file_url: designFileUrl || null,
          digital_product_id: null,
          customizations: lightweightCustomizations,
        }

        const { data: createdItem } = await supabaseServer.from("order_items").insert([orderItem]).select("id").single()
        if (uploadedId && createdItem?.id) {
          try {
            await promoteOrderFileIfNeeded({ orderFileId: uploadedId, orderItemId: createdItem.id })
          } catch {}
        }
      }
    }

    const { data: itemsForEnrichment } = await supabaseServer
      .from("order_items")
      .select("id,design_file_url,design_image_url,print_ready_file_url,customizations")
      .eq("order_id", orderId)

    if (itemsForEnrichment && itemsForEnrichment.length > 0) {
      for (const row of itemsForEnrichment as any[]) {
        try {
          const c = row.customizations || {}
          const uploaded = c?.uploadedFiles && c.uploadedFiles[0]
          const uploadedId = (uploaded?.id as string | undefined) || null

          if (uploadedId) {
            await promoteOrderFileIfNeeded({ orderFileId: uploadedId, orderItemId: row.id })
            continue
          }

          const uploadedPath = (uploaded?.path as string | undefined) || null
          const currentFileUrl = row.design_file_url || row.print_ready_file_url || null
          const tempPath = uploadedPath || extractPathFromPublicUrl(currentFileUrl, legacyBucket)
          if (tempPath && tempPath.includes("uploads/temp/")) {
            const fileName = tempPath.split("/").pop()!
            const orderPath = `uploads/orders/${orderId}/${fileName}`
            await supabaseServer.storage.from(legacyBucket).copy(tempPath, orderPath)
            await supabaseServer.storage.from(legacyBucket).remove([tempPath])
            const { data: pub } = supabaseServer.storage.from(legacyBucket).getPublicUrl(orderPath)
            const url = pub?.publicUrl || null
            if (url) {
              const designImageUrl = row.design_image_url || c?.preview_url || url
              await supabaseServer
                .from("order_items")
                .update({
                  design_file_url: url,
                  print_ready_file_url: url,
                  design_image_url: designImageUrl,
                })
                .eq("id", row.id)
            }
          }
        } catch {}
      }
    }

    const digitalIds = new Set<string>()
    if (Array.isArray(digitalCartItems)) {
      for (const d of digitalCartItems) {
        const id = (d as any)?.productId || (d as any)?.designId
        if (id) digitalIds.add(id)
      }
    }

    const { data: existingDigitalItems } = await supabaseServer
      .from("order_items")
      .select("digital_product_id")
      .eq("order_id", orderId)
      .not("digital_product_id", "is", null)

    if (existingDigitalItems) {
      for (const r of existingDigitalItems as any[]) {
        if (r.digital_product_id) digitalIds.add(r.digital_product_id)
      }
    }

    if (digitalIds.size > 0) {
      for (const productId of Array.from(digitalIds)) {
        try {
          await markDigitalProductAsPurchased(productId, orderId, transactionId)
        } catch {}
      }
    }

    // 4. Clear the user's cart (assuming a server-side cart clearing mechanism)
    // await clearCart(user.id); // This would depend on your cart implementation

    // 5. Send emails only on successful payment
    const successStatuses = new Set(["completed", "succeeded", "approved", "paid", "success"])
    const normalized = (paymentStatus || "").toString().toLowerCase()
    if (successStatuses.has(normalized)) {
      try {
        const { data: emailItems } = await supabaseServer
          .from('order_items')
          .select('name, quantity, price')
          .eq('order_id', orderId)

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        const isDigital = (shippingMethod || updatedOrder.shipping_method || orderRow.shipping_method) === "download"
        const resolvedCustomerEmail = customerEmail || updatedOrder.email || orderRow.email
        if (!resolvedCustomerEmail) {
          return NextResponse.json({ success: true, order: updatedOrder }, { status: 200 })
        }
        const resolvedShipping = shippingAddress || updatedOrder.shipping_address || orderRow.shipping_address || {}
        const payload = {
          customerEmail: resolvedCustomerEmail,
          customerName:
            `${resolvedShipping?.firstName || ""} ${resolvedShipping?.lastName || ""}`.trim() || resolvedCustomerEmail,
          orderNumber: updatedOrder.order_number,
          orderTotal: Number(updatedOrder.total || total || orderRow.total || 0).toFixed(2),
          paymentMethod: paymentMethod || updatedOrder.payment_method || "",
          orderUrl: `${siteUrl}/orders/${orderId}/confirmation?status=success`,
          estimatedDelivery: isDigital ? "Instant download after payment" : "3-5 business days",
          orderItems: (emailItems || []).map((i: any) => ({
            name: i.name,
            quantity: i.quantity || 1,
            price: Number(i.price || 0).toFixed(2),
          })),
        }
        await sendOrderConfirmationEmail(payload)
        // Optional: notify admin after successful payment
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/email/admin/new-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          })
        } catch (_) {}
      } catch (_) {}
    }

    return NextResponse.json({ success: true, order: updatedOrder }, { status: 200 })
  } catch (error: any) {
    console.error("Error in payment confirmation route:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
