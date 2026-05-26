import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { supabaseServer } from "@/lib/supabase-server"

interface WompiPaymentRequest {
  tarjetaCreditoDebido: {
    numeroTarjeta: string
    cvv: string
    mesVencimiento: number
    anioVencimiento: number
  }
  monto: number
  nombre: string
  apellido: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  idRegion: string
  codigoPostal: string
  idPais: string
  urlRedirect: string
  configuracion: {
    emailsNotificacion: string
    telefonosNotificacion: string
    notificarTransaccionCliente: boolean
    urlWebhook: string
  }
  datosAdicionales: any
  idExterno: string
}

// Wompi Test Mode Helper - Based on official documentation
// https://docs.wompi.sv/metodos-api/transaccion_prueba
function getTestModeInfo(paymentData: WompiPaymentRequest) {
  const cvv = paymentData.tarjetaCreditoDebido.cvv
  const cardNumber = paymentData.tarjetaCreditoDebido.numeroTarjeta
  
  // Avoid logging card details or CVV
  
  // According to Wompi docs: CVV "111" simulates rejected payment
  if (cvv === "111") {
    console.log("❌ CVV '111' detected - Will simulate rejected payment")
    return {
      expectsRejection: true,
      reason: "CVV 111 triggers rejection in Wompi test mode"
    }
  }
  
  console.log("✅ Normal CVV - Will process as successful test transaction")
  return {
    expectsRejection: false,
    reason: "Normal test transaction"
  }
}

// Extract user-friendly messages from Wompi error responses
function extractUserFriendlyMessage(wompiError: any): string {
  if (!wompiError) {
    return "Payment processing failed. Please try again."
  }
  
  // Handle Wompi's mensajes array
  if (wompiError.mensajes && Array.isArray(wompiError.mensajes) && wompiError.mensajes.length > 0) {
    const message = wompiError.mensajes[0]
    if (!message || message.trim() === "") {
      return "Provider endpoint not found or incompatible payload. Please verify Wompi endpoint configuration."
    }
    
    // Phone number validation error
    if (message.includes("formatos de telefonos") || message.includes("no son válidos")) {
      return "Invalid phone number format. Please enter a valid El Salvador phone number without dashes (numbers only)."
    }
    
    // Card validation errors
    if (message.includes("tarjeta") || message.includes("card")) {
      return "Invalid card information. Please check your card details and try again."
    }
    
    // Email validation errors
    if (message.includes("email") || message.includes("correo")) {
      return "Invalid email format. Please enter a valid email address."
    }
    
    // Generic validation error
    if (message.includes("válido") || message.includes("formato")) {
      return "Invalid information format. Please check your details and try again."
    }
    
    // Return the original message if no specific pattern matches
    return message
  }
  
  // Handle other error formats
  if (wompiError.mensaje) {
    return wompiError.mensaje
  }
  
  if (wompiError.error) {
    return wompiError.error
  }
  
  return "Payment processing failed. Please check your information and try again."
}

// Safe database operation with error handling
async function safeDbOperation(operation: () => Promise<any>, description: string) {
  try {
    console.log(`📊 Attempting ${description}...`)
    const result = await operation()
    console.log(`✅ ${description} successful`)
    return result
  } catch (error) {
    console.error(`⚠️ ${description} failed:`, error)
    return null
  }
}

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
function cleanPath(p: string) {
  // Remove zero-width and BOM characters then trim spaces
  return (p || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim()
}
function joinEndpoint(base: string, path: string) {
  const p = cleanPath(path)
  if (/^https?:\/\//i.test(p)) {
    // Already absolute URL from admin config
    return trimSlash(p)
  }
  const cleaned = p.replace(/^\/+/, "")
  return `${trimSlash(base)}/${cleaned}`
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
      const baseUrlRaw =
        (data.endpoints && (data.endpoints as any).base_url) || process.env.WOMPI_BASE_URL || "https://api.wompi.sv"
      const endpointsObj: any = data.endpoints || {}
      let transactionPath = endpointsObj.transaction_path || endpointsObj.transactions || null
      let threeDsPath = endpointsObj.three_ds_path || null
      if (!threeDsPath && typeof transactionPath === "string" && /3ds/i.test(transactionPath)) {
        threeDsPath = transactionPath
        transactionPath = null
      }
      return {
        clientId: sanitizeKey(data.api_key || process.env.WOMPI_CLIENT_ID || ""),
        clientSecret: sanitizeKey(data.api_secret || process.env.WOMPI_CLIENT_SECRET || ""),
        baseUrl: normalizeBaseUrl(baseUrlRaw),
        transactionPath,
        threeDsPath,
      }
    }
  } catch (e) {
    // fall through to env
  }
  return {
    clientId: sanitizeKey(process.env.WOMPI_CLIENT_ID || ""),
    clientSecret: sanitizeKey(process.env.WOMPI_CLIENT_SECRET || ""),
    baseUrl: normalizeBaseUrl(process.env.WOMPI_BASE_URL || "https://api.wompi.sv"),
    transactionPath: null,
    threeDsPath: null,
  }
}

// Enhanced real Wompi API with detailed debugging
async function attemptRealWompiPayment(paymentData: WompiPaymentRequest) {
  const creds = await getWompiCredentials()
  const WOMPI_CLIENT_ID = creds.clientId
  const WOMPI_CLIENT_SECRET = creds.clientSecret
  const WOMPI_BASE_URL = creds.baseUrl

  if (!WOMPI_CLIENT_ID || !WOMPI_CLIENT_SECRET) {
    throw new Error("Wompi credentials not configured")
  }

  // OAuth token request with resilient fallbacks
  async function obtainOAuthToken(): Promise<any> {
    const basic = Buffer.from(`${WOMPI_CLIENT_ID}:${WOMPI_CLIENT_SECRET}`).toString("base64")
    const attempts: Array<{ name: string; headers: Record<string, string>; body: string }> = [
      {
        name: "BodyCredentials+Audience",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "DeliveryPrint-MVP/1.0", Authorization: "" },
        body: new URLSearchParams({ grant_type: "client_credentials", audience: "wompi_api", client_id: WOMPI_CLIENT_ID, client_secret: WOMPI_CLIENT_SECRET }).toString(),
      },
      {
        name: "BasicAuth+Audience",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: `Basic ${basic}`, "User-Agent": "DeliveryPrint-MVP/1.0" },
        body: new URLSearchParams({ grant_type: "client_credentials", audience: "wompi_api" }).toString(),
      },
      {
        name: "BasicAuthMinimal",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", Authorization: `Basic ${basic}`, "User-Agent": "DeliveryPrint-MVP/1.0" },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      },
    ]

    let lastErrorText = ""
    for (const attempt of attempts) {
      const resp = await fetch("https://id.wompi.sv/connect/token", { method: "POST", headers: attempt.headers, body: attempt.body })
      console.log(`📡 OAuth response status (${attempt.name}):`, resp.status)
      const txt = await resp.text()
      if (resp.ok) {
        try { return JSON.parse(txt) } catch { throw new Error("Invalid OAuth response format") }
      }
      lastErrorText = txt
    }
    throw new Error(`OAuth failed: 400 - ${lastErrorText}`)
  }

  const tokenData = await obtainOAuthToken()

  console.log("🔐 === STEP 2: PAYMENT API REQUEST ===")

  // Try multiple API endpoints and payload formats
  const candidatePaths: string[] = []
  if (creds.threeDsPath) candidatePaths.push(creds.threeDsPath)
  if (creds.transactionPath) candidatePaths.push(creds.transactionPath)
  // Fallback defaults
  candidatePaths.push(
    "/TransaccionCompra/3DS",
    "/TransaccionCompra",
    "/api/TransaccionCompra",
    "/v1/TransaccionCompra"
  )
  const apiEndpoints = candidatePaths.map((p) => joinEndpoint(WOMPI_BASE_URL, p))

  // Compatibility for SV environment and 3DS requirements
  const ensureElSalvadorCompatibility = (data: WompiPaymentRequest): WompiPaymentRequest => {
    const isSV = /\.wompi\.sv$/i.test(WOMPI_BASE_URL)
    if (!isSV) return data
    const d: WompiPaymentRequest = { ...data }
    // Map USA to UE when requested; otherwise preserve incoming country code
    const mapCountry = (code: string) => (code === "US" ? "UE" : code)
    d.idPais = mapCountry(d.idPais || "SV")
    // Apply SV-specific defaults only when idPais is SV
    if (d.idPais === "SV") {
      d.idRegion = d.idRegion || "SV-SS"
      d.telefono = (d.telefono || "70000000").replace(/\D/g, "").slice(0, 8)
      d.ciudad = d.ciudad || "San Salvador"
      d.direccion = d.direccion || "Direccion"
      d.codigoPostal = ((d.codigoPostal || "01101").replace(/\D/g, "")).padStart(5, "0")
    }
    // Normalize phone for CA/UE to digits only and 10 chars if provided
    if (d.idPais === "CA" || d.idPais === "UE") {
      d.telefono = (d.telefono || "").replace(/\D/g, "").slice(0, 10)
    }
    d.urlRedirect =
      d.urlRedirect || `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/payment-complete?reference=${encodeURIComponent(d.idExterno)}&status=success&type=wompi`
    return d
  }

  const compatData = ensureElSalvadorCompatibility(paymentData)
  const acceptLang =
    compatData.idPais === "SV"
      ? "es-SV,es;q=0.9"
      : compatData.idPais === "CA"
      ? "en-CA,en;q=0.9"
      : compatData.idPais === "UE"
      ? "en-US,en;q=0.9"
      : "en-US,en;q=0.9"

  // Full payload first (as requested)
  const fullPayload = {
    tarjetaCreditoDebido: {
      numeroTarjeta: compatData.tarjetaCreditoDebido.numeroTarjeta,
      cvv: compatData.tarjetaCreditoDebido.cvv,
      mesVencimiento: compatData.tarjetaCreditoDebido.mesVencimiento,
      anioVencimiento: compatData.tarjetaCreditoDebido.anioVencimiento,
    },
    monto: compatData.monto,
    nombre: compatData.nombre,
    apellido: compatData.apellido,
    email: compatData.email,
    telefono: compatData.telefono,
    direccion: compatData.direccion,
    ciudad: compatData.ciudad,
    idRegion: compatData.idRegion,
    codigoPostal: compatData.codigoPostal,
    idPais: compatData.idPais,
    urlRedirect: compatData.urlRedirect,
    configuracion: compatData.configuracion,
    idExterno: compatData.idExterno,
    datosAdicionales: {
      additionalProp1: "test",
      additionalProp2: "delivery_print",
      additionalProp3: "mvp",
    },
  }

  // Minimal payload second
  const minimalPayload = {
    tarjetaCreditoDebido: {
      numeroTarjeta: compatData.tarjetaCreditoDebido.numeroTarjeta,
      cvv: compatData.tarjetaCreditoDebido.cvv,
      mesVencimiento: compatData.tarjetaCreditoDebido.mesVencimiento,
      anioVencimiento: compatData.tarjetaCreditoDebido.anioVencimiento,
    },
    monto: compatData.monto,
    nombre: compatData.nombre,
    apellido: compatData.apellido,
    email: compatData.email,
    idExterno: compatData.idExterno,
  }

  // Changed order: Full payload first, then minimal
  const payloads = [
    { name: "Full", data: fullPayload },
  ]

  let lastError = null

  // Try different combinations
  for (const endpoint of apiEndpoints) {
    const is3ds = /\/3ds$/i.test(endpoint)
    for (const payload of payloads) {
      if (is3ds && payload.name === "Minimal") {
        continue // 3DS requires full payload
      }
      let timeoutId: NodeJS.Timeout | null = null
      let controller: AbortController | null = null
      
      try {
        console.log(`🚀 Trying ${payload.name} payload at: ${endpoint}`)
        console.log("📤 Payload:", {
          ...payload.data,
          tarjetaCreditoDebido: {
            ...payload.data.tarjetaCreditoDebido,
            numeroTarjeta: `****${payload.data.tarjetaCreditoDebido.numeroTarjeta.slice(-4)}`,
            cvv: "***",
          },
        })

        // Add timeout protection to prevent hanging
        controller = new AbortController()
        timeoutId = setTimeout(() => {
          controller?.abort()
          console.log(`⏰ Request to ${endpoint} timed out after 30 seconds`)
        }, 30000) // 30 second timeout
        
        const paymentResponse = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Language": acceptLang,
            Authorization: `Bearer ${tokenData.access_token}`,
            "User-Agent": "DeliveryPrint-MVP/1.0",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(payload.data),
        })

        // Clear timeout on successful response
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        
        console.log("📡 Payment response status:", paymentResponse.status)

        const responseText = await paymentResponse.text()

        if (paymentResponse.ok) {
          console.log("✅ Payment API call succeeded!")
          const responseData = JSON.parse(responseText)

          // Transform response to our format
          if (responseData.estado === "EXITOSO" || responseData.estado === "APROBADO") {
            return {
              success: true,
              data: {
                idTransaccion: responseData.idTransaccion,
                numeroReferencia: responseData.numeroReferencia,
                codigoAutorizacion: responseData.codigoAutorizacion,
                estado: responseData.estado,
                mensaje: responseData.mensaje,
              },
            }
          } else if (responseData.urlCompletarPago3Ds) {
            // 3DS authentication required - use the exact URL from Wompi
            return {
              success: true,
              requiresAuth: true,
              data: {
                idTransaccion: responseData.idTransaccion,
                numeroReferencia: responseData.numeroReferencia,
                urlCompletarPago3Ds: responseData.urlCompletarPago3Ds,
                estado: "PENDIENTE_3DS",
                monto: responseData.monto,
                esReal: responseData.esReal,
              },
            }
        } else {
            let message = responseText
            try {
              const errJson = JSON.parse(responseText)
              message = extractUserFriendlyMessage(errJson)
            } catch {}
            console.log(`❌ ${endpoint} with ${payload.name} payload failed: ${paymentResponse.status} - ${responseText}`)
            return {
              success: false,
              error: message || "Payment failed",
              code: String(paymentResponse.status),
              estado: "ERROR",
            }
          }
        } else {
          console.log(`❌ ${endpoint} with ${payload.name} payload failed: ${paymentResponse.status}`)
          
          // Parse Wompi error response for better error handling
          let wompiError
          try {
            wompiError = JSON.parse(responseText)
            // Do not log full error details from provider
          } catch (parseError) {
            console.log("⚠️ Could not parse error response as JSON")
            wompiError = { mensajes: [responseText] }
          }
          
          // Create structured error for frontend handling
          const structuredError = {
            success: false,
            error: "validation_error",
            code: paymentResponse.status,
            wompiError: wompiError,
            userMessage: extractUserFriendlyMessage(wompiError),
            canRetry: true
          }
          
          lastError = new Error(JSON.stringify(structuredError))
        }
      } catch (error) {
        // Clear timeout in case of error
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`⏰ Request to ${endpoint} with ${payload.name} payload timed out after 30 seconds`)
          lastError = new Error(`Payment request timed out. Please try again.`)
        } else {
          console.log(`❌ Error with ${endpoint} and ${payload.name} payload:`, error instanceof Error ? error.message : 'Unknown error')
          lastError = error instanceof Error ? error : new Error('Unknown error occurred')
        }
      }
    }
  }

  // If we get here, all attempts failed
  throw lastError || new Error("All payment API attempts failed")
}

export async function POST(request: NextRequest) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }

  try {
    console.log("🎯 === WOMPI PAYMENT API CALLED ===")

    // Parse request body with error handling
    let paymentData: WompiPaymentRequest
    try {
      const body = await request.text()
      console.log("📝 Raw request body length:", body.length)
      paymentData = JSON.parse(body)
      console.log("✅ Request parsed successfully")
      console.log("📋 Order ID:", paymentData.idExterno)
      console.log("💰 Amount:", paymentData.monto)
      console.log("💳 Card ending in:", paymentData.tarjetaCreditoDebido?.numeroTarjeta?.slice(-4) || "N/A")
    } catch (parseError) {
      console.error("❌ Failed to parse request:", parseError)
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format",
          details: parseError instanceof Error ? parseError.message : "Unknown parse error",
        },
        { status: 400, headers },
      )
    }

    // Validate required fields
    const validationErrors = []

    if (!paymentData.tarjetaCreditoDebido?.numeroTarjeta) {
      validationErrors.push("Card number is required")
    }

    if (!paymentData.monto || paymentData.monto <= 0) {
      validationErrors.push("Payment amount is required")
    }

    if (!paymentData.email) {
      validationErrors.push("Email address is required")
    }

    if (validationErrors.length > 0) {
      console.error("❌ Validation errors:", validationErrors)
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationErrors.join(", "),
        },
        { status: 400, headers },
      )
    }

    const { supabaseServer } = await import("@/lib/supabase-server")
    const { data: wompiProvider } = await (supabaseServer as any)
      .from("payment_settings")
      .select("additional_settings")
      .eq("provider_name", "wompi")
      .maybeSingle()

    const bypassWompi = !!wompiProvider?.additional_settings?.bypass_wompi
    let isAdmin = false
    const auth = request.headers.get("authorization") || request.headers.get("Authorization")
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice(7)
      const { data: userData } = await supabaseServer.auth.getUser(token)
      const userId = userData?.user?.id || null
      if (userId) {
        const { data: profile } = await (supabaseServer as any).from("user_profiles").select("role").eq("id", userId).maybeSingle()
        isAdmin = profile?.role === "admin"
      }
    }

    // Try to save to database (optional - won't fail if DB is unavailable)
    await safeDbOperation(async () => {
      const transactionData = {
        id_externo: paymentData.idExterno,
        monto: paymentData.monto,
        estado: "pending",
        es_real: false,
        metodo_pago: "wompi",
        nombre: paymentData.nombre,
        apellido: paymentData.apellido,
        email: paymentData.email,
        telefono: paymentData.telefono,
        ciudad: paymentData.ciudad,
        direccion: paymentData.direccion,
        id_pais: paymentData.idPais,
        id_region: paymentData.idRegion,
        codigo_postal: paymentData.codigoPostal,
        ultimos_digitos_tarjeta: paymentData.tarjetaCreditoDebido.numeroTarjeta.slice(-4),
        url_redirect: paymentData.urlRedirect,
        datos_adicionales: paymentData.datosAdicionales,
        created_at: new Date().toISOString(),
      }

      return await supabaseServer.from("wompi_transactions").insert(transactionData)
    }, "database transaction creation")

    // Process payment using Wompi API (Test or Production mode)
    let paymentResult

    // Get test mode information for debugging
    const testModeInfo = getTestModeInfo(paymentData)
    console.log("🧪 Test Mode Info:", testModeInfo)

    console.log("🚀 === PROCESSING WOMPI PAYMENT ===")
    console.log("🔍 Using Wompi API with proper test mode support")
    
    let createdOrderIdForBypass: string | null = null
    try {
      if (bypassWompi && isAdmin && process.env.NODE_ENV !== "production") {
        const reference = paymentData.idExterno
        const { data: sessionRow, error: sessionErr } = await (supabaseServer as any)
          .from("checkout_sessions")
          .select("*")
          .eq("reference", reference)
          .single()
        if (sessionErr || !sessionRow) throw new Error("Checkout session not found for reference")

        if (sessionRow.status !== "completed" || !sessionRow.order_id) {
          const cartItems: any[] = Array.isArray(sessionRow.cart_items) ? sessionRow.cart_items : []
          if (cartItems.length === 0) throw new Error("Checkout session missing cart_items")

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
          if (orderErr || !createdOrder) throw new Error(orderErr?.message || "Failed to create order")
          createdOrderIdForBypass = createdOrder.id

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

          const isUuid = (value: unknown) =>
            typeof value === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

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
          if (itemsErr) throw new Error(itemsErr.message)

          if (uploadedFileIds.size > 0) {
            await (supabaseServer as any).from("uploaded_files").update({ status: "permanent" }).in("id", Array.from(uploadedFileIds))
          }

          await (supabaseServer as any)
            .from("checkout_sessions")
            .update({ status: "completed", order_id: createdOrder.id, updated_at: nowIso })
            .eq("id", sessionRow.id)

          sessionRow.order_id = createdOrder.id
          sessionRow.status = "completed"
        }

        paymentResult = {
          success: true,
          requiresAuth: false,
          simulated: true,
          data: {
            idTransaccion: `SIM-${crypto.randomUUID()}`,
            numeroReferencia: null,
            urlCompletarPago3Ds: null,
            estado: "APROBADO",
            monto: paymentData.monto,
            esReal: false,
            orderId: sessionRow.order_id,
          },
        }
      } else {
      paymentResult = await attemptRealWompiPayment(paymentData)
      console.log("✅ Wompi API call completed!")
      }

      // Update database to mark as processed
      await safeDbOperation(async () => {
        return await supabaseServer
          .from("wompi_transactions")
          .update({ 
            es_real: true,
            test_mode_info: testModeInfo 
          })
          .eq("id_externo", paymentData.idExterno)
      }, "updating transaction with test mode info")
    } catch (apiError) {
       console.error("❌ Wompi API failed:", apiError instanceof Error ? apiError.message : "Unknown error")
       
       // Try to parse structured error from Wompi
       let structuredError
       try {
         if (apiError instanceof Error && apiError.message.startsWith('{')) {
           structuredError = JSON.parse(apiError.message)
         }
       } catch (parseError) {
         console.log("⚠️ Could not parse structured error")
       }
       
       // Return structured error if available, otherwise generic error
       if (structuredError && structuredError.error === "validation_error") {
         paymentResult = structuredError
       } else {
         paymentResult = {
           success: false,
           error: "api_error",
           userMessage: "Payment processing failed. Please try again.",
           code: "API_ERROR",
           estado: "ERROR",
           canRetry: true
         }
       }
     }

    // Update database with result (optional)
    await safeDbOperation(async () => {
      const updateData: any = {
        wompi_response: paymentResult,
        updated_at: new Date().toISOString(),
      }

      if (paymentResult.success && paymentResult.data?.idTransaccion) {
        updateData.id_transaccion = paymentResult.data.idTransaccion
        updateData.estado = paymentResult.data.urlCompletarPago3Ds ? "pending_3ds" : "completed"
        updateData.authorization_code = paymentResult.data.codigoAutorizacion
        updateData.reference_number = paymentResult.data.numeroReferencia
        updateData.three_ds_url = paymentResult.data.urlCompletarPago3Ds
      } else {
        updateData.estado = "failed"
      }

      return await supabaseServer.from("wompi_transactions").update(updateData).eq("id_externo", paymentData.idExterno)
    }, "updating transaction with result")

    // Record into unified payment_transactions when bypass created an order immediately
    if (createdOrderIdForBypass && paymentResult?.success) {
      await safeDbOperation(async () => {
        return await (supabaseServer as any)
          .from("payment_transactions")
          .insert({
            order_id: createdOrderIdForBypass,
            provider_name: "wompi",
            transaction_id: crypto.randomUUID(),
            external_transaction_id: paymentResult?.data?.idTransaccion || null,
            amount: Number(paymentResult?.data?.monto ?? paymentData.monto ?? 0),
            currency: "USD",
            status: "completed",
            payment_method: "wompi",
            response_data: paymentResult,
            error_message: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
      }, "recording unified payment transaction (bypass)")
    }

    console.log("🎉 === PAYMENT PROCESSING COMPLETE ===")
    console.log("📊 Result:", paymentResult)

    return NextResponse.json(paymentResult, { headers })
  } catch (error) {
    console.error("❌ === CRITICAL ERROR ===")
    console.error("Error type:", error?.constructor?.name)
    console.error("Error message:", error instanceof Error ? error.message : "Unknown error")
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    const errorResponse = {
      success: false,
      error: "Payment processing failed",
      details: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(errorResponse, { status: 500, headers })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
