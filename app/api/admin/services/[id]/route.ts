import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { requireRoleWithProfile } from "@/lib/rbac"

export const dynamic = "force-dynamic"

function shouldDeleteStorageObject(storagePath: string) {
  const p = storagePath.trim()
  if (!p) return false
  if (p.startsWith("http://") || p.startsWith("https://")) return false
  return true
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!(auth as any).ok) return NextResponse.json({ error: "Unauthorized" }, { status: (auth as any).status || 401 })

    const serviceId = context.params.id

    const { data: existing } = await supabaseServer.from("services").select("id").eq("id", serviceId).maybeSingle()
    if (!existing?.id) return NextResponse.json({ error: "Service not found." }, { status: 404 })

    const { data: serviceImages, error: serviceImagesError } = await supabaseServer.from("service_images").select("storage_path").eq("service_id", serviceId)
    if (serviceImagesError) return NextResponse.json({ error: serviceImagesError.message }, { status: 500 })

    const { data: productImages, error: productImagesError } = await supabaseServer.from("service_product_images").select("storage_path").eq("service_id", serviceId)
    if (productImagesError) return NextResponse.json({ error: productImagesError.message }, { status: 500 })

    const paths = ([] as any[])
      .concat(serviceImages || [])
      .concat(productImages || [])
      .map((r: any) => String(r.storage_path ?? ""))
      .filter((p) => shouldDeleteStorageObject(p))

    if (paths.length > 0) {
      const { error: removeError } = await supabaseServer.storage.from("product-images").remove(paths)
      if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 })
    }

    const { error: deleteProductImagesError } = await supabaseServer.from("service_product_images").delete().eq("service_id", serviceId)
    if (deleteProductImagesError) return NextResponse.json({ error: deleteProductImagesError.message }, { status: 500 })
    if (imagesError) return NextResponse.json({ error: imagesError.message }, { status: 500 })
    const { error: deleteImagesError } = await supabaseServer.from("service_images").delete().eq("service_id", serviceId)

    // Deleting the service will also cascade variants/options (and any remaining images) via FK constraints.
    const { error: deleteProductsError } = await supabaseServer.from("service_products").delete().eq("service_id", serviceId)
    if (deleteProductsError) return NextResponse.json({ error: deleteProductsError.message }, { status: 500 })

    const { error: deleteServiceError } = await supabaseServer.from("services").delete().eq("id", serviceId)


    return new NextResponse(null, { status: 204 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal server error." }, { status: 500 })
  }
}
