import { NextRequest, NextResponse } from "next/server"
import { fetchPRStatus } from "@/lib/github-api"

export async function GET(req: NextRequest) {
  const prUrl = req.nextUrl.searchParams.get("url")
  
  if (!prUrl) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 })
  }

  const prInfo = await fetchPRStatus(prUrl)
  
  if (!prInfo) {
    return NextResponse.json({ error: "Could not fetch PR status" }, { status: 404 })
  }

  return NextResponse.json(prInfo)
}
