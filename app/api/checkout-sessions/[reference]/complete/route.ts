import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import crypto from "crypto"

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value as string)

export async function POST(req: Request, { params }: { params: { reference: string } }) {
  try {
    const reference = params.reference
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 })

    const nowIso = new Date().toISOString()

    let forcedApproved = false
    let incomingTxId: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      forcedApproved = !!body?.forcedApproved
      incomingTxId = typeof body?.transactionId === "string" ? body.transactionId : null
    } catch {}

    // 1) Ensure payment was confirmed (or forced via redirect)
    const { data: tx } = await (supabaseServer as any)
      .from("wompi_transactions")
      .select("id, estado, status, wompi_response, wompi_transaction_id, authorization_code, reference_number, amount, currency")
      .eq("id_externo", reference)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const estado = (tx?.estado || tx?.status || "").toString().toLowerCase()
    const paidStates = new Set(["completed","completado","exitoso","aprobado","aprobada","success","succeeded","approved","paid"]) 
    let isPaid = forcedApproved || paidStates.has(estado)
    if (!isPaid && tx?.wompi_response) {
      try {
        const wr: any = typeof tx.wompi_response === "string" ? JSON.parse(tx.wompi_response) : tx.wompi_response
        const esAprobadaVal = (wr?.esAprobada ?? wr?.data?.esAprobada ?? "").toString().toLowerCase()
        const mensajeVal = (wr?.mensaje ?? wr?.data?.mensaje ?? "").toString().toUpperCase()
        if (esAprobadaVal === "true" || mensajeVal === "AUTORIZADO") {
          isPaid = true
        }
      } catch {}
    }
    if (!isPaid) {
      // Attempt server-side verification to refresh status before giving up
      const txId = incomingTxId || ((tx?.wompi_transaction_id as string) || null)
      if (txId) {
        try {
          const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
          await fetch(`${base}/api/payments/wompi/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId: txId, orderId: null }),
          })
          const { data: tx2 } = await (supabaseServer as any)
            .from("wompi_transactions")
            .select("estado, status, wompi_response")
            .eq("id_externo", reference)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          const estado2 = (tx2?.estado || tx2?.status || "").toString().toLowerCase()
          if (paidStates.has(estado2)) {
            isPaid = true
          } else if (tx2?.wompi_response) {
            try {
              const wr2: any = typeof tx2.wompi_response === "string" ? JSON.parse(tx2.wompi_response) : tx2.wompi_response
              const ok = (wr2?.esAprobada ?? wr2?.data?.esAprobada ?? "").toString().toLowerCase() === "true"
              const msgOk = (wr2?.mensaje ?? wr2?.data?.mensaje ?? "").toString().toUpperCase() === "AUTORIZADO"
              if (ok || msgOk) isPaid = true
            } catch {}
          }
        } catch {}
      }
      if (!isPaid && !forcedApproved) {
        return NextResponse.json({ error: "Payment not confirmed yet" }, { status: 409 })
      }
    }

    // 2) Load checkout session
    const { data: sessionRow, error: sessionErr } = await (supabaseServer as any)
      .from("checkout_sessions")
      .select("*")
      .eq("reference", reference)
      .single()
    if (sessionErr || !sessionRow) return NextResponse.json({ error: "Checkout session not found" }, { status: 404 })

    if (sessionRow.status === "completed" && sessionRow.order_id) {
      return NextResponse.json({ success: true, order_id: sessionRow.order_id }, { status: 200 })
    }

    const cartItems: any[] = Array.isArray(sessionRow.cart_items) ? sessionRow.cart_items : []
    if (cartItems.length === 0) return NextResponse.json({ error: "Checkout session missing cart_items" }, { status: 400 })

    const orderInsert: any = {
      user_id: sessionRow.user_id || null,
      email: sessionRow.email || null,
      order_number: `ORD-${Date.now()}`,
      status: "pending",
      subtotal: Number(sessionRow.subtotal ?? 0),
      tax: Number(sessionRow.tax ?? 0),
      shipping: Number(sessionRow.shipping ?? 0),
      discount: 0,
      total: Number(sessionRow.total ?? 0),
      shipping_method: sessionRow.shipping_method || null,
      payment_method: "wompi",
      billing_address: sessionRow.billing_address || {},
      shipping_address: sessionRow.shipping_address || {},
      notes: sessionRow.notes || null,
      currency: "USD",
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data: createdOrder, error: orderErr } = await (supabaseServer as any)
      .from("orders")
      .insert([orderInsert])
      .select()
      .single()
    if (orderErr || !createdOrder) return NextResponse.json({ error: orderErr?.message || "Failed to create order" }, { status: 500 })

    const uploadedFileIds = new Set<string>()
    for (const item of cartItems) {
      const uploadedFileId = typeof item?.uploaded_file_id === "string" ? item.uploaded_file_id : null
      if (uploadedFileId) uploadedFileIds.add(uploadedFileId)
    }

    const uploadedFilesById = new Map<string, any>()
    if (uploadedFileIds.size > 0) {
      const { data: uploads } = await (supabaseServer as any)
        .from("uploaded_files")
        .select("id, file_url, original_filename")
        .in("id", Array.from(uploadedFileIds))
      for (const u of uploads || []) uploadedFilesById.set(u.id, u)
    }

    const orderItemsPayload = cartItems.map((item) => {
      const uploadedFileId = typeof item?.uploaded_file_id === "string" ? item.uploaded_file_id : null
      const upload = uploadedFileId ? uploadedFilesById.get(uploadedFileId) : null
      const fileUrl = (typeof item?.file_url === "string" ? item.file_url : null) || upload?.file_url || null
      const materialType = typeof item?.material_type === "string" ? item.material_type : null
      const qty = Number(item?.quantity ?? 1)
      const price = Number(item?.price ?? 0)
      const maybeProductId = typeof item?.product_id === "string" ? item.product_id : null
      const productId = isUuid(maybeProductId) ? maybeProductId : null
      const maybeVariantId = typeof item?.variant_id === "string" ? item.variant_id : null
      const variantId = isUuid(maybeVariantId) ? maybeVariantId : null
      const maybeDesignId = typeof item?.design_id === "string" ? item.design_id : null
      const designId = isUuid(maybeDesignId) ? maybeDesignId : null
      const name = typeof item?.name === "string" && item.name.trim() ? item.name.trim() : materialType || "Print Item"
      const productImageUrl = typeof item?.product_image_url === "string" ? item.product_image_url : null
      const designImageUrl = (typeof item?.design_image_url === "string" ? item.design_image_url : null) || fileUrl
      const designFileUrl = (typeof item?.design_file_url === "string" ? item.design_file_url : null) || fileUrl
      const customizedImageUrl = typeof item?.customized_image_url === "string" ? item.customized_image_url : null
      const printReadyFileUrl = (typeof item?.print_ready_file_url === "string" ? item.print_ready_file_url : null) || fileUrl
      const customizations = (item && typeof item === "object" && "customizations" in item ? (item as any).customizations : null) ?? item ?? null
      return {
        order_id: createdOrder.id,
        product_id: productId,
        variant_id: variantId,
        design_id: designId,
        digital_product_id: null,
        name,
        material_type: materialType,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        price: Number.isFinite(price) ? price : 0,
        customizations,
        product_image_url: productImageUrl,
        design_image_url: designImageUrl,
        design_file_url: designFileUrl,
        customized_image_url: customizedImageUrl,
        print_ready_file_url: printReadyFileUrl,
      }
    })

    const { error: itemsErr } = await (supabaseServer as any).from("order_items").insert(orderItemsPayload)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    await (supabaseServer as any)
      .from("checkout_sessions")
      .update({ status: "completed", order_id: createdOrder.id, updated_at: nowIso })
      .eq("id", sessionRow.id)

    // Optionally advance order status to confirmed now that payment is completed
    await (supabaseServer as any)
      .from("orders")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", createdOrder.id)

    // Record into unified payment_transactions for Admin view
    await (supabaseServer as any)
      .from("payment_transactions")
      .insert({
        order_id: createdOrder.id,
        provider_name: "wompi",
        transaction_id: crypto.randomUUID(),
        external_transaction_id: tx?.wompi_transaction_id || null,
        amount: Number(tx?.amount ?? sessionRow.total ?? 0),
        currency: (tx?.currency as string) || "USD",
        status: "completed",
        payment_method: "wompi",
        response_data: tx?.wompi_response || null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    return NextResponse.json({ success: true, order_id: createdOrder.id }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
