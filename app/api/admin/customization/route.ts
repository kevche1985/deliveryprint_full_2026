import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Customization is disabled" }, { status: 404 })
}

export async function PUT() {
  return NextResponse.json({ error: "Customization is disabled" }, { status: 404 })
}
