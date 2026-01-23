import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN not set" }, { status: 500 })
  }

  const body = await request.json()
  const { repo, title, description, assignToCursor } = body

  if (!repo || !title) {
    return NextResponse.json({ error: "repo and title are required" }, { status: 400 })
  }

  // Strip github.com/ prefix if present
  const repoPath = repo.replace(/^(https?:\/\/)?github\.com\//, "")

  // Create the issue
  const createRes = await fetch(`https://api.github.com/repos/${repoPath}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      body: description || "",
    }),
  })

  if (!createRes.ok) {
    const error = await createRes.text()
    console.error("GitHub API error creating issue:", createRes.status, error)
    return NextResponse.json({ error: "Failed to create issue" }, { status: createRes.status })
  }

  const issue = await createRes.json()

  // If assignToCursor is true, comment on the issue
  if (assignToCursor) {
    const commentRes = await fetch(
      `https://api.github.com/repos/${repoPath}/issues/${issue.number}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: `@cursor fix this issue (#${issue.number})` }),
      }
    )

    if (!commentRes.ok) {
      console.error("Failed to add cursor comment:", await commentRes.text())
      // Don't fail the whole request, issue was created successfully
    }
  }

  return NextResponse.json({
    url: issue.html_url,
    number: issue.number,
  })
}
