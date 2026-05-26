"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/lib/language-context"
import { track } from "@/lib/analytics"
import { useCart } from "@/lib/cart-context"
import { useDigitalCart } from "@/lib/digital-cart-context"

export default function PaymentCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { t } = useLanguage()
  const { clearCart } = useCart()
  const { clearCart: clearDigitalCart } = useDigitalCart()
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processingDetails, setProcessingDetails] = useState<string | null>(null)

  const orderId = searchParams.get("orderId")
  const reference = searchParams.get("reference")
  const status = searchParams.get("status")
  const type = searchParams.get("type")
  const paypalOrderId = searchParams.get("token") // PayPal returns this as 'token'

  useEffect(() => {
    const handlePaymentCompletion = async () => {
      if (type === "wompi" && reference) {
        const simulate = searchParams.get("simulate") === "1"
        if (simulate) {
          try {
            const { data: sessionData } = await (await import("@/lib/supabase")).supabase.auth.getSession()
            const accessToken = sessionData.session?.access_token || null
            const res = await fetch("/api/webhooks/wompi/simulate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
              body: JSON.stringify({ reference }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error || "Simulation failed")
            const createdOrderId = data?.order_id
            if (createdOrderId) {
              setSuccess(true)
              clearCart()
              clearDigitalCart()
              toast({ title: t("payment.success.title"), description: t("payment.3ds.success.message") })
              router.push(`/orders/${createdOrderId}/confirmation`)
              return
            }
          } catch (e: any) {
            setError(e?.message || "Simulation failed")
            setLoading(false)
            return
          }
        }

        const approvedParam = searchParams.get("esAprobada")
        const wompiMessage = searchParams.get("mensaje")
        if (approvedParam && approvedParam.toLowerCase() === "false") {
          setError(wompiMessage || t("payment.3ds.failed.message"))
          setLoading(false)
          return
        }

        setProcessingDetails(t("payment.3ds.processing.message"))

        const transactionId =
          searchParams.get("transaction") || searchParams.get("idTransaccion") || searchParams.get("id") || null

        if (transactionId) {
          // Fast-path: if Wompi already says approved, complete checkout session immediately
          if (approvedParam && approvedParam.toLowerCase() === "true") {
            try {
              const completeRes = await fetch(`/api/checkout-sessions/${encodeURIComponent(reference)}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ forcedApproved: true, transactionId }),
              })
              if (completeRes.ok) {
                const completeData = await completeRes.json().catch(() => ({}))
                const createdOrderId = completeData?.order_id || null
                if (createdOrderId) {
                  setSuccess(true)
                  clearCart()
                  clearDigitalCart()
                  // Trigger server-side confirmation to send emails and finalize status
                  try {
                    await fetch("/api/payments/confirm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId: createdOrderId,
                        paymentMethod: "wompi",
                        paymentStatus: "completed",
                        transactionId,
                      }),
                    })
                  } catch {}
                  track("payment_success", { reference, provider: "wompi", transactionId })
                  toast({ title: t("payment.success.title"), description: t("payment.3ds.success.message") })
                  router.push(`/orders/${createdOrderId}/confirmation`)
                  return
                }
              }
            } catch {}
            // If immediate completion didn’t return the order, continue with verification below
          }

          try {
            const verifyRes = await fetch("/api/payments/wompi/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactionId }),
            })
            const verifyData = await verifyRes.json().catch(() => ({}))
            const normalized = (verifyData?.status || verifyData?.data?.estado || "").toString().toUpperCase()
            const isApproved = ["EXITOSO", "APROBADO", "APROBADA"].includes(normalized)

            if (isApproved) {
              const completeRes = await fetch(`/api/checkout-sessions/${encodeURIComponent(reference)}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactionId }),
              })
              if (completeRes.ok) {
                const completeData = await completeRes.json().catch(() => ({}))
                const createdOrderId = completeData?.order_id || null
                if (createdOrderId) {
                  setSuccess(true)
                  clearCart()
                  clearDigitalCart()
                  track("payment_success", { reference, provider: "wompi" })
                  toast({ title: t("payment.success.title"), description: t("payment.3ds.success.message") })
                  router.push(`/orders/${createdOrderId}/confirmation`)
                  return
                }
              }
            } else if (approvedParam && approvedParam.toLowerCase() === "true") {
              // Fallback: Wompi redirected with esAprobada=true but verification didn't return approved yet.
              // Do not mark as failure; proceed to session polling below.
              setProcessingDetails(t("payment.3ds.verifying"))
            }
          } catch {}
        }

        const maxAttempts = 30
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const res = await fetch(`/api/checkout-sessions/${encodeURIComponent(reference)}`, { method: "GET" })
            if (res.ok) {
              const data = await res.json()
              const cs = data?.checkout_session
              const createdOrderId = cs?.order_id || null
              if (cs?.status === "completed" && createdOrderId) {
                setSuccess(true)
                clearCart()
                clearDigitalCart()
                track("payment_success", { reference, provider: "wompi" })
                toast({ title: t("payment.success.title"), description: t("payment.3ds.success.message") })
                router.push(`/orders/${createdOrderId}/confirmation`)
                return
              }
            }
          } catch {}

          await new Promise((r) => setTimeout(r, 2000))
        }

        setError(wompiMessage || "Order is still processing. Please refresh in a moment.")
        setLoading(false)
        return
      }

      if (!orderId) {
        setError(t("common.error"))
        setLoading(false)
        return
      }

      if (status === "success" && type === "paypal" && paypalOrderId) {
        try {
          console.log("Capturing PayPal payment:", { paypalOrderId, orderId })
          setProcessingDetails(t("payment.3ds.verifying"))

          // Capture the PayPal payment
          const response = await fetch("/api/payments/paypal/capture-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderID: paypalOrderId,
              orderId: orderId,
            }),
          })

          // Log the raw response for debugging
          const responseText = await response.text()
          console.log("PayPal capture response status:", response.status)
          console.log("PayPal capture response text:", responseText)

          let data
          try {
            data = JSON.parse(responseText)
          } catch (e) {
            console.error("Failed to parse response as JSON:", e)
            throw new Error(`Invalid response from server: ${responseText}`)
          }

          if (data.success) {
            setProcessingDetails(t("payment.3ds.processing.title"))
            setSuccess(true)
            try {
              await fetch("/api/payments/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  transactionId: data.captureId || paypalOrderId,
                  paymentMethod: "paypal",
                  paymentStatus: "completed",
                }),
              })
            } catch {}
            clearCart()
            clearDigitalCart()
            track("payment_success", { orderId, provider: "paypal", captureId: data.captureId })
            toast({
              title: t("payment.success.title"),
              description: t("payment.3ds.success.message"),
            })
          } else {
            throw new Error(data.error || data.details || "Failed to capture payment")
          }
        } catch (err: any) {
          console.error("Payment capture error:", err)
          setError(err.message || t("payment.error.processingFailed"))
          track("payment_failure", { orderId, provider: "paypal", error: err?.message })
          toast({
            title: t("payment.error.title"),
            description: err.message || t("payment.error.processingFailed"),
            variant: "destructive",
          })
        }
      } else if (status === "success") {
        // For other payment types that are already processed
        setSuccess(true)
        try {
          await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              paymentMethod: type || "unknown",
              paymentStatus: "completed",
            }),
          })
        } catch {}
        clearCart()
        clearDigitalCart()
        track("payment_success", { orderId, provider: type || "unknown" })
      } else if (status === "cancel" && type === "paypal") {
        setError(t("common.error"))
        track("payment_cancel", { orderId, provider: "paypal" })
      } else {
        setError(t("payment.3ds.failed.message"))
        track("payment_failure", { orderId, provider: type || "unknown" })
      }

      setLoading(false)
    }

    handlePaymentCompletion()
  }, [orderId, status, type, paypalOrderId, toast])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <h2 className="text-lg font-semibold mb-2">{t("payment.3ds.processing.title")}</h2>
            <p className="text-gray-600 text-center">
              {processingDetails || t("payment.3ds.processing.message")}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {success ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
          </div>
          <CardTitle className={success ? "text-green-700" : "text-red-700"}>
            {success ? t("payment.3ds.success.title") : t("payment.3ds.failed.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {success ? (
            <>
              <p className="text-gray-600">{t("payment.3ds.success.message")}</p>
              <div className="space-y-2">
                <Button
                  onClick={() => router.push(`/orders/${orderId}/confirmation`)}
                  className="w-full bg-[#8B0000] hover:bg-[#6B0000]"
                >
                  {t("payment.3ds.viewOrder")}
                </Button>
                <Button onClick={() => router.push("/orders")} variant="outline" className="w-full">
                  {t("payment.3ds.viewAllOrders")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600">{error || t("payment.3ds.failed.message")}</p>
              <div className="space-y-2">
                <Button onClick={() => router.push("/checkout")} className="w-full bg-[#8B0000] hover:bg-[#6B0000]">
                  {t("payment.3ds.tryAgain")}
                </Button>
                <Button onClick={() => router.push("/orders")} variant="outline" className="w-full">
                  {t("payment.3ds.viewAllOrders")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
