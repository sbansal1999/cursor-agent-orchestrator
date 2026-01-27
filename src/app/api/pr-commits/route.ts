import { NextRequest, NextResponse } from "next/server"
import { fetchPRCommits } from "@/lib/github-api"

export async function GET(req: NextRequest) {
  const prUrl = req.nextUrl.searchParams.get("url")

  if (!prUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  const commits = await fetchPRCommits(prUrl)

  if (!commits) {
    return NextResponse.json({ error: "Could not fetch PR commits" }, { status: 404 })
  }

  return NextResponse.json({ commits })
}
