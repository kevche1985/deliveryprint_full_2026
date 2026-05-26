import { type NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id
    const body = await request.json()
    if (!orderId) return NextResponse.json({ error: "Missing order id" }, { status: 400 })
    const priceNum = typeof body.price === "number" ? body.price : Number(body.price ?? 0)
    const quantityNum = typeof body.quantity === "number" ? body.quantity : Number(body.quantity ?? 1)

    const isUuid = (value: unknown) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

    const customizations = body.customizations ?? null
    const incomingProductId = body.product_id ?? null
    const resolvedProductId = isUuid(incomingProductId) ? incomingProductId : null
    const resolvedCustomizations =
      !resolvedProductId && typeof incomingProductId === "string"
        ? {
            ...(customizations && typeof customizations === "object" ? customizations : {}),
            service_product_id: incomingProductId,
          }
        : customizations

    const item = {
      order_id: orderId,
      product_id: resolvedProductId,
      variant_id: body.variant_id ?? null,
      design_id: body.design_id ?? null,
      digital_product_id: body.digital_product_id ?? null,
      name: body.name,
      quantity: Number.isFinite(quantityNum) && quantityNum > 0 ? quantityNum : 1,
      price: Number.isFinite(priceNum) ? priceNum : 0,
      customizations: resolvedCustomizations,
      product_image_url: body.product_image_url ?? null,
      design_image_url: body.design_image_url ?? null,
      design_file_url: body.design_file_url ?? null,
      customized_image_url: body.customized_image_url ?? null,
      print_ready_file_url: body.print_ready_file_url ?? null,
    }
    if (!item.name || Number.isNaN(item.price)) {
      return NextResponse.json({ error: "Invalid item" }, { status: 400 })
    }
    const { data, error } = await supabaseServer.from("order_items").insert([item]).select().single()
    if (error) {
      console.error("Failed to insert order item:", error, "payload:", item)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, item: data })
  } catch (e: any) {
    console.error("Unexpected error creating order item:", e)
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
