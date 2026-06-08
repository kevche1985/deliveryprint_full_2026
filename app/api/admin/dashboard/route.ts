import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/rbac"
import { supabaseServer } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

type OrderRow = {
  id: string
  created_at: string
  total: number | string | null
  status: string | null
  order_number: string | null
  email: string | null
}

type UserRow = {
  id: string
  created_at: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string | null
  status: string | null
}

type ProductRow = {
  id: string
  created_at: string
}

type QuoteRow = {
  id: string
  created_at: string
  status: string | null
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request as any, ["admin", "operator"])
    if (!auth.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })
    }

    const [ordersResult, usersResult, productsResult, quotesResult] = await Promise.all([
      supabaseServer
        .from("orders")
        .select("id, created_at, total, status, order_number, email")
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("user_profiles")
        .select("id, created_at, first_name, last_name, email, role, status")
        .order("created_at", { ascending: false }),
      supabaseServer.from("products").select("id, created_at"),
      supabaseServer.from("quotes").select("id, created_at, status"),
    ])

    if (ordersResult.error) return NextResponse.json({ error: ordersResult.error.message }, { status: 500 })
    if (usersResult.error) return NextResponse.json({ error: usersResult.error.message }, { status: 500 })
    if (productsResult.error) return NextResponse.json({ error: productsResult.error.message }, { status: 500 })
    if (quotesResult.error) return NextResponse.json({ error: quotesResult.error.message }, { status: 500 })

    const orders = (ordersResult.data || []) as OrderRow[]
    const users = (usersResult.data || []) as UserRow[]
    const products = (productsResult.data || []) as ProductRow[]
    const quotes = (quotesResult.data || []) as QuoteRow[]

    const now = Date.now()
    const currentPeriodStart = now - 30 * 24 * 60 * 60 * 1000
    const previousPeriodStart = now - 60 * 24 * 60 * 60 * 1000

    const totalRevenue = orders.reduce((sum, order) => sum + asNumber(order.total), 0)
    const totalOrders = orders.length
    const totalUsers = users.length
    const totalProducts = products.length
    const pendingOrders = orders.filter((order) => (order.status || "").toLowerCase() === "pending").length
    const completedOrders = orders.filter((order) => (order.status || "").toLowerCase() === "completed").length
    const pendingQuotes = quotes.filter((quote) => (quote.status || "").toLowerCase() === "pending").length
    const activeUsers = users.filter((user) => (user.status || "").toLowerCase() === "active").length

    const currentRevenue = orders
      .filter((order) => new Date(order.created_at).getTime() >= currentPeriodStart)
      .reduce((sum, order) => sum + asNumber(order.total), 0)
    const previousRevenue = orders
      .filter((order) => {
        const ts = new Date(order.created_at).getTime()
        return ts >= previousPeriodStart && ts < currentPeriodStart
      })
      .reduce((sum, order) => sum + asNumber(order.total), 0)

    const currentOrders = orders.filter((order) => new Date(order.created_at).getTime() >= currentPeriodStart).length
    const previousOrders = orders.filter((order) => {
      const ts = new Date(order.created_at).getTime()
      return ts >= previousPeriodStart && ts < currentPeriodStart
    }).length

    const currentUsers = users.filter((user) => new Date(user.created_at).getTime() >= currentPeriodStart).length
    const previousUsers = users.filter((user) => {
      const ts = new Date(user.created_at).getTime()
      return ts >= previousPeriodStart && ts < currentPeriodStart
    }).length

    const currentProducts = products.filter((product) => new Date(product.created_at).getTime() >= currentPeriodStart).length
    const previousProducts = products.filter((product) => {
      const ts = new Date(product.created_at).getTime()
      return ts >= previousPeriodStart && ts < currentPeriodStart
    }).length

    const chartMonths = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setUTCDate(1)
      date.setUTCHours(0, 0, 0, 0)
      date.setUTCMonth(date.getUTCMonth() - (5 - index))
      return {
        key: monthKey(date),
        month: monthLabel(date),
        revenue: 0,
        orders: 0,
      }
    })

    const monthMap = new Map(chartMonths.map((item) => [item.key, item]))
    for (const order of orders) {
      const createdAt = new Date(order.created_at)
      const bucket = monthMap.get(monthKey(createdAt))
      if (!bucket) continue
      bucket.revenue += asNumber(order.total)
      bucket.orders += 1
    }

    const statusConfig = [
      { key: "pending", name: "Pending", color: "#F59E0B" },
      { key: "processing", name: "Processing", color: "#3B82F6" },
      { key: "completed", name: "Completed", color: "#10B981" },
      { key: "cancelled", name: "Cancelled", color: "#EF4444" },
      { key: "shipped", name: "Shipped", color: "#8B5CF6" },
      { key: "confirmed", name: "Confirmed", color: "#06B6D4" },
    ]

    const statusCounts = new Map<string, number>()
    for (const order of orders) {
      const key = (order.status || "pending").toLowerCase()
      statusCounts.set(key, (statusCounts.get(key) || 0) + 1)
    }

    let orderStatusData = statusConfig
      .map((status) => ({
        name: status.name,
        value: statusCounts.get(status.key) || 0,
        color: status.color,
      }))
      .filter((status) => status.value > 0)

    if (orderStatusData.length === 0) {
      orderStatusData = [{ name: "No Orders", value: 1, color: "#D1D5DB" }]
    }

    const recentOrders = orders.slice(0, 5).map((order) => ({
      id: order.id,
      order_number: order.order_number || order.id,
      email: order.email || "No email",
      total: asNumber(order.total),
      status: (order.status || "pending").toLowerCase(),
      created_at: order.created_at,
    }))

    const recentUsers = users.slice(0, 5).map((user) => ({
      id: user.id,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "No email",
      role: (user.role || "customer").toLowerCase(),
      status: (user.status || "pending").toLowerCase(),
      created_at: user.created_at,
    }))

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalOrders,
        totalUsers,
        totalProducts,
        pendingOrders,
        completedOrders,
        pendingQuotes,
        activeUsers,
      },
      changes: {
        totalRevenue: percentChange(currentRevenue, previousRevenue),
        totalOrders: percentChange(currentOrders, previousOrders),
        totalUsers: percentChange(currentUsers, previousUsers),
        totalProducts: percentChange(currentProducts, previousProducts),
      },
      revenueData: chartMonths,
      orderStatusData,
      recentOrders,
      recentUsers,
    })
  } catch (error) {
    console.error("Error in GET /api/admin/dashboard:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
