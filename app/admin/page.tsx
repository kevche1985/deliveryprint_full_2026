"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react"
import { motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/language-context"

type DashboardStats = {
  totalRevenue: number
  totalOrders: number
  totalUsers: number
  totalProducts: number
  pendingOrders: number
  completedOrders: number
  pendingQuotes: number
  activeUsers: number
}

type DashboardData = {
  stats: DashboardStats
  changes: Record<string, number>
  revenueData: Array<{ month: string; revenue: number; orders: number }>
  orderStatusData: Array<{ name: string; value: number; color: string }>
  recentOrders: Array<{
    id: string
    order_number: string
    email: string
    total: number
    status: string
    created_at: string
  }>
  recentUsers: Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    role: string
    status: string
    created_at: string
  }>
}

export default function AdminDashboard() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    completedOrders: 0,
    pendingQuotes: 0,
    activeUsers: 0,
  })
  const [changes, setChanges] = useState<Record<string, number>>({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalProducts: 0,
  })
  const [revenueData, setRevenueData] = useState<Array<{ month: string; revenue: number; orders: number }>>([])
  const [orderStatusData, setOrderStatusData] = useState<Array<{ name: string; value: number; color: string }>>([])
  const [recentOrders, setRecentOrders] = useState<DashboardData["recentOrders"]>([])
  const [recentUsers, setRecentUsers] = useState<DashboardData["recentUsers"]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        let token = ""
        for (let attempt = 0; attempt < 5; attempt++) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          token = session?.access_token || ""
          if (token) break
          await new Promise((resolve) => setTimeout(resolve, 250))
        }

        const response = await fetch("/api/admin/dashboard", {
          cache: "no-store",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })

        if (!response.ok) {
          throw new Error(`Failed to load dashboard: ${response.status}`)
        }

        const data: DashboardData = await response.json()
        setStats(data.stats)
        setChanges(data.changes || {})
        setRevenueData(data.revenueData || [])
        setOrderStatusData(data.orderStatusData || [])
        setRecentOrders(data.recentOrders || [])
        setRecentUsers(data.recentUsers || [])
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  const formatChange = (value: number) => {
    const sign = value > 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}%`
  }

  const statCards = [
    {
      title: t("admin.dashboard.statCards.totalRevenue"),
      value: `$${stats.totalRevenue.toFixed(2)}`,
      change: formatChange(changes.totalRevenue || 0),
      changeType: (changes.totalRevenue || 0) >= 0 ? "positive" : "negative",
      icon: DollarSign,
    },
    {
      title: t("admin.dashboard.statCards.totalOrders"),
      value: stats.totalOrders.toString(),
      change: formatChange(changes.totalOrders || 0),
      changeType: (changes.totalOrders || 0) >= 0 ? "positive" : "negative",
      icon: ShoppingCart,
    },
    {
      title: t("admin.dashboard.statCards.totalUsers"),
      value: stats.totalUsers.toString(),
      change: formatChange(changes.totalUsers || 0),
      changeType: (changes.totalUsers || 0) >= 0 ? "positive" : "negative",
      icon: Users,
    },
    {
      title: t("admin.dashboard.statCards.totalProducts"),
      value: stats.totalProducts.toString(),
      change: formatChange(changes.totalProducts || 0),
      changeType: (changes.totalProducts || 0) >= 0 ? "positive" : "negative",
      icon: Package,
    },
  ]

  const quickStats = [
    {
      title: t("admin.dashboard.quickStats.pendingOrders"),
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: t("admin.dashboard.quickStats.completedOrders"),
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: t("admin.dashboard.quickStats.pendingQuotes"),
      value: stats.pendingQuotes,
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: t("admin.dashboard.quickStats.activeUsers"),
      value: stats.activeUsers,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ]

  const getOrderBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700"
      case "pending":
        return "bg-yellow-100 text-yellow-700"
      case "processing":
        return "bg-blue-100 text-blue-700"
      case "cancelled":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getUserInitials = (firstName: string, lastName: string, email: string) => {
    const first = firstName?.trim()?.charAt(0) || ""
    const last = lastName?.trim()?.charAt(0) || ""
    const fallback = email?.trim()?.charAt(0) || "U"
    return `${first}${last}`.trim() || fallback.toUpperCase()
  }

  return (
    <div className="space-y-6 -mt-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t("admin.dashboard.headerTitle")}</h1>
        <p className="text-gray-500">{t("admin.dashboard.headerSubtitle")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <div className="flex items-center mt-1">
                      {stat.changeType === "positive" ? (
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span className={`text-sm ${stat.changeType === "positive" ? "text-green-600" : "text-red-600"}`}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-[#8B0000] bg-opacity-10 rounded-full">
                    <stat.icon className="h-6 w-6 text-[#8B0000]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className={`p-2 rounded-full ${stat.bgColor} mr-4`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue and order trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#8B0000" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
            <CardDescription>Current order status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest customer orders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Order #{order.order_number}</p>
                    <p className="text-sm text-gray-600">{order.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${order.total.toFixed(2)}</p>
                    <Badge className={getOrderBadgeVariant(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
              {!loading && recentOrders.length === 0 && <p className="text-sm text-gray-500">No recent orders</p>}
            </div>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link href="/admin/orders">View All Orders</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Newly registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-[#8B0000] rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                      {getUserInitials(user.first_name, user.last_name, user.email)}
                    </div>
                    <div>
                      <p className="font-medium">{`${user.first_name} ${user.last_name}`.trim() || "Unnamed User"}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Badge>
                </div>
              ))}
              {!loading && recentUsers.length === 0 && <p className="text-sm text-gray-500">No recent users</p>}
            </div>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link href="/admin/users">View All Users</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
