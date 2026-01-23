import { NextRequest, NextResponse } from "next/server"
import { fetchIssueComments } from "@/lib/github-api"

export async function GET(req: NextRequest) {
  const issueUrl = req.nextUrl.searchParams.get("url")

  if (!issueUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  const comments = await fetchIssueComments(issueUrl)

  if (!comments) {
    return NextResponse.json({ error: "Could not fetch issue comments" }, { status: 404 })
  }

  return NextResponse.json({ comments })
}
