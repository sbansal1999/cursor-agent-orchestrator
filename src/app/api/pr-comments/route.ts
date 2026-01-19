import { NextRequest, NextResponse } from "next/server"
import { fetchPRComments } from "@/lib/github-api"

export async function GET(req: NextRequest) {
  const prUrl = req.nextUrl.searchParams.get("url")

  if (!prUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  const comments = await fetchPRComments(prUrl)

  if (!comments) {
    return NextResponse.json({ error: "Could not fetch PR comments" }, { status: 404 })
  }

  return NextResponse.json({ comments })
}
