import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null)
    if (!payload) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })

    const normalizedStatus =
      (payload?.data?.transaction?.status || payload?.estado || payload?.estadoTransaccion || payload?.status || "")
        .toString()
        .toUpperCase()

    const approvedStatuses = new Set(["APPROVED", "APROBADA", "APROBADO", "EXITOSO", "COMPLETED", "SUCCESS"])
    if (!approvedStatuses.has(normalizedStatus)) {
      return NextResponse.json({ success: true, ignored: true }, { status: 200 })
    }

    const reference =
      payload?.data?.transaction?.reference ||
      payload?.idExterno ||
      payload?.id_externo ||
      payload?.idExternoPago ||
      payload?.reference

    if (!reference || typeof reference !== "string") {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 })
    }

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
    if (cartItems.length === 0) {
      return NextResponse.json({ error: "Checkout session missing cart_items" }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const orderNumber = `ORD-${Date.now()}`

    const orderInsert: any = {
      user_id: sessionRow.user_id || null,
      email: sessionRow.email || null,
      order_number: orderNumber,
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

    const { data: createdOrder, error: orderErr } = await supabaseServer.from("orders").insert([orderInsert]).select().single()
    if (orderErr || !createdOrder) {
      return NextResponse.json({ error: orderErr?.message || "Failed to create order" }, { status: 500 })
    }

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
      const originalName = upload?.original_filename || null

      const materialType = typeof item?.material_type === "string" ? item.material_type : null
      const qty = Number(item?.quantity ?? 1)
      const price = Number(item?.price ?? 0)

      const maybeProductId = typeof item?.product_id === "string" ? item.product_id : null
      const productId = isUuid(maybeProductId) ? maybeProductId : null

      return {
        order_id: createdOrder.id,
        product_id: productId,
        variant_id: null,
        design_id: null,
        digital_product_id: null,
        name: materialType || "Print Item",
        material_type: materialType,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        price: Number.isFinite(price) ? price : 0,
        customizations: item ?? null,
        product_image_url: null,
        design_image_url: fileUrl,
        design_file_url: fileUrl,
        design_original_filename: originalName,
        uploaded_file_id: uploadedFileId,
        customized_image_url: null,
        print_ready_file_url: fileUrl,
      }
    })

    const { error: itemsErr } = await supabaseServer.from("order_items").insert(orderItemsPayload)
    if (itemsErr) {
      await (supabaseServer as any)
        .from("checkout_sessions")
        .update({ status: "failed", updated_at: nowIso, order_id: createdOrder.id })
        .eq("id", sessionRow.id)
      return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }

    if (uploadedFileIds.size > 0) {
      await (supabaseServer as any)
        .from("uploaded_files")
        .update({ status: "permanent" })
        .in("id", Array.from(uploadedFileIds))
    }

    await (supabaseServer as any)
      .from("checkout_sessions")
      .update({ status: "completed", order_id: createdOrder.id, updated_at: nowIso })
      .eq("id", sessionRow.id)

    return NextResponse.json({ success: true, order_id: createdOrder.id }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

