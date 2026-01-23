import { NextRequest, NextResponse } from "next/server"
import { markPRReadyForReview } from "@/lib/github-api"

export async function POST(req: NextRequest) {
  const { prUrl } = await req.json()

  if (!prUrl) {
    return NextResponse.json({ error: "Missing prUrl" }, { status: 400 })
  }

  const success = await markPRReadyForReview(prUrl)

  if (!success) {
    return NextResponse.json({ error: "Failed to mark PR ready" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
