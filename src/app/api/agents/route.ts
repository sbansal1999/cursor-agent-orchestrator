import { NextRequest, NextResponse } from "next/server"
import { listAgents } from "@/lib/cursor-api"

export async function GET(request: NextRequest) {
  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined
    const data = await listAgents(cursor)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
