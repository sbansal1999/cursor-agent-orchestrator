import { NextResponse } from "next/server"
import { listAllAgents } from "@/lib/cursor-api"

export async function GET() {
  try {
    const data = await listAllAgents()
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
