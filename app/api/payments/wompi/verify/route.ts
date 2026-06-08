import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { supabaseServer } from "@/lib/supabase-server"

function trimSlash(url: string) {
  return url.replace(/\/+$/, "")
}
function normalizeBaseUrl(raw: string) {
  let url = (raw || "").trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  url = url.replace("svv1", "sv")
  url = trimSlash(url)
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return "https://api.wompi.sv"
  }
}

async function getWompiCredentials() {
  const sanitizeKey = (s: string) => (s || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim()
  try {
    const { data, error } = await supabaseServer
      .from("payment_settings")
      .select("api_key, api_secret, endpoints")
      .eq("provider_name", "wompi")
      .maybeSingle()
    if (!error && data) {
      const baseUrl =
        normalizeBaseUrl((data.endpoints && (data.endpoints as any).base_url) || process.env.WOMPI_BASE_URL || "https://api.wompi.sv")
      return {
        clientId: sanitizeKey(data.api_key || process.env.WOMPI_CLIENT_ID || ""),
        clientSecret: sanitizeKey(data.api_secret || process.env.WOMPI_CLIENT_SECRET || ""),
        baseUrl,
      }
    }
  } catch {}
  return {
    clientId: sanitizeKey(process.env.WOMPI_CLIENT_ID || ""),
    clientSecret: sanitizeKey(process.env.WOMPI_CLIENT_SECRET || ""),
    baseUrl: normalizeBaseUrl(process.env.WOMPI_BASE_URL || "https://api.wompi.sv"),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { transactionId, orderId } = await request.json()

    console.log("🔍 Verifying Wompi transaction:", { transactionId, orderId })

    // Get OAuth token
    const creds = await getWompiCredentials()
    const WOMPI_CLIENT_ID = creds.clientId
    const WOMPI_CLIENT_SECRET = creds.clientSecret
    const WOMPI_BASE_URL = creds.baseUrl

    if (!WOMPI_CLIENT_ID || !WOMPI_CLIENT_SECRET) {
      throw new Error("Wompi credentials not configured")
    }

    // Get OAuth token (try multiple formats to avoid tenant mismatch)
    const basic = Buffer.from(`${WOMPI_CLIENT_ID}:${WOMPI_CLIENT_SECRET}`).toString("base64")
    const attempts: Array<{ headers: Record<string, string>; body: string; name: string }> = [
      {
        name: "BodyCredentials+Audience",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ grant_type: "client_credentials", audience: "wompi_api", client_id: WOMPI_CLIENT_ID, client_secret: WOMPI_CLIENT_SECRET }).toString(),
      },
      {
        name: "BasicAuth+Audience",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: `Basic ${basic}` },
        body: new URLSearchParams({ grant_type: "client_credentials", audience: "wompi_api" }).toString(),
      },
      {
        name: "BasicAuthMinimal",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: `Basic ${basic}` },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      },
    ]

    let tokenData: any = null
    let lastTokenError = ""
    for (const a of attempts) {
      const tr = await fetch("https://id.wompi.sv/connect/token", { method: "POST", headers: a.headers, body: a.body })
      if (tr.ok) { tokenData = await tr.json(); break }
      lastTokenError = await tr.text()
    }
    if (!tokenData) {
      throw new Error(`Failed to get OAuth token: ${lastTokenError}`)
    }

    // Query transaction status
    // Query transaction status (try multiple endpoints)
    const candidates = [
      `/Transaccion/${transactionId}`,
      `/api/Transaccion/${transactionId}`,
      `/v1/Transaccion/${transactionId}`,
    ]
    let statusData: any = null
    for (const p of candidates) {
      const url = `${WOMPI_BASE_URL}/${p.replace(/^\/+/, "")}`
      const sr = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
      })
      if (sr.ok) { statusData = await sr.json(); break }
    }
    if (!statusData) {
      // Fallback: read last stored transaction row
      const { data: txRow } = await supabaseServer
        .from("wompi_transactions")
        .select("estado, wompi_response")
        .eq("id_transaccion", transactionId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!txRow) {
        throw new Error("Failed to query transaction status")
      }
      statusData = txRow.wompi_response || { estado: txRow.estado || "" }
    }
    console.log("📊 Transaction status:", statusData)

    // Update database with final status
    try {
      await supabaseServer
        .from("wompi_transactions")
        .update({
          estado: statusData.estado?.toLowerCase(),
          wompi_response: statusData,
          updated_at: new Date().toISOString(),
        })
        .eq("id_transaccion", transactionId)

      // Update order status if payment successful
      const normalizedEstado = (statusData.estado || "").toString().toUpperCase()
      const isApproved = normalizedEstado === "EXITOSO" || normalizedEstado === "APROBADO"
      const isPending3ds = normalizedEstado === "PENDIENTE_3DS"

      // Upsert into unified payment_transactions for admin visibility
      try {
        await supabaseServer
          .from("payment_transactions")
          .upsert({
            order_id: orderId || null,
            provider_name: "wompi",
            transaction_id: crypto.randomUUID(),
            external_transaction_id: transactionId,
            amount: Number((statusData.data?.monto ?? statusData.monto ?? 0) || 0),
            currency: (statusData.data?.currency as string) || "USD",
            status: isApproved ? "completed" : isPending3ds ? "pending_3ds" : "error",
            payment_method: "wompi",
            response_data: statusData,
            error_message: isApproved ? null : isPending3ds ? null : (statusData.mensaje || statusData.error || null),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "external_transaction_id" })
      } catch (_) {}

      if (orderId && isApproved) {
        await supabaseServer
          .from("orders")
          .update({
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
      }
    } catch (dbError) {
      console.error("Database update error:", dbError)
    }

    return NextResponse.json({
      success: true,
      status: statusData.estado,
      data: statusData,
    })
  } catch (error) {
    console.error("Transaction verification error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 500 },
    )
  }
}
