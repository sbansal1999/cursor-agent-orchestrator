import { NextRequest, NextResponse } from "next/server"
import { commentOnIssue } from "@/lib/github-api"

export async function POST(req: NextRequest) {
  const { issueUrl, comment } = await req.json()

  if (!issueUrl || !comment) {
    return NextResponse.json({ error: "Missing issueUrl or comment" }, { status: 400 })
  }

  const success = await commentOnIssue(issueUrl, comment)

  if (!success) {
    return NextResponse.json({ error: "Failed to comment on issue" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
