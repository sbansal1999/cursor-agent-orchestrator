import { NextRequest, NextResponse } from "next/server"
import { commentOnPR } from "@/lib/github-api"

export async function POST(req: NextRequest) {
  const { prUrl, comment } = await req.json()

  if (!prUrl || !comment) {
    return NextResponse.json({ error: "Missing prUrl or comment" }, { status: 400 })
  }

  const success = await commentOnPR(prUrl, comment)

  if (!success) {
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
