import { NextRequest, NextResponse } from "next/server"
import { requireRoleWithProfile } from "@/lib/rbac"
import { supabaseServer } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRoleWithProfile(request, ["admin", "operator"])
    if (!auth.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })
    }

    const { data: profile, error } = await supabaseServer
      .from("user_profiles")
      .select("id, first_name, last_name, email, role, status")
      .eq("id", auth.userId)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        ...profile,
        email: profile.email || undefined,
      },
    })
  } catch (error) {
    console.error("Error in GET /api/admin/me:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
