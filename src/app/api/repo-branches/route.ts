import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN not set" }, { status: 500 })
  }

  const repo = request.nextUrl.searchParams.get("repo")
  if (!repo) {
    return NextResponse.json({ error: "repo is required" }, { status: 400 })
  }

  const repoPath = repo.replace(/^(https?:\/\/)?github\.com\//, "")
  const res = await fetch(`https://api.github.com/repos/${repoPath}/branches?per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const error = await res.text()
    console.error("GitHub API error fetching branches:", res.status, error)
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: res.status })
  }

  const branches = (await res.json()).map((branch: { name: string }) => branch.name)
  return NextResponse.json({ branches })
}
