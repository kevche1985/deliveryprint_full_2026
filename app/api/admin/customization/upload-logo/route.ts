import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json({ error: "Customization is disabled" }, { status: 404 })
}
