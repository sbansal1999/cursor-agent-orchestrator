import { NextRequest, NextResponse } from "next/server"
import { sendFollowup } from "@/lib/cursor-api"
import { FollowupRequestSchema } from "@/lib/schemas"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { message } = FollowupRequestSchema.parse(body)
    await sendFollowup(id, message)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
