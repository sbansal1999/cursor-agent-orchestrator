export type PRStatus = "open" | "merged" | "closed"

export interface PRInfo {
  status: PRStatus
  title: string
  number: number
  updatedAt: string
}

export function parsePrUrl(prUrl: string): { owner: string; repo: string; number: number } | null {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

export async function fetchPRStatus(prUrl: string): Promise<PRInfo | null> {
  const parsed = parsePrUrl(prUrl)
  if (!parsed) {
    console.error("Failed to parse PR URL:", prUrl)
    return null
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN not set, cannot fetch PR status")
    return null
  }

  const res = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      next: { revalidate: 60 },
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`GitHub API error: ${res.status}`, body)
    return null
  }

  const data = await res.json()
  
  let status: PRStatus = "open"
  if (data.merged) {
    status = "merged"
  } else if (data.state === "closed") {
    status = "closed"
  }

  return {
    status,
    title: data.title,
    number: data.number,
    updatedAt: data.updated_at,
  }
}

export interface PRComment {
  id: number
  user: string
  body: string
  createdAt: string
  isBot: boolean
}

export async function fetchPRComments(prUrl: string): Promise<PRComment[] | null> {
  const parsed = parsePrUrl(prUrl)
  if (!parsed) {
    console.error("Failed to parse PR URL:", prUrl)
    return null
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN not set")
    return null
  }

  const res = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}/comments?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`GitHub API error: ${res.status}`, body)
    return null
  }

  const data = await res.json()
  
  return data.map((comment: any) => ({
    id: comment.id,
    user: comment.user.login,
    body: comment.body,
    createdAt: comment.created_at,
    isBot: comment.user.type === "Bot",
  }))
}

export async function commentOnPR(prUrl: string, comment: string): Promise<boolean> {
  const parsed = parsePrUrl(prUrl)
  if (!parsed) {
    console.error("Failed to parse PR URL:", prUrl)
    return false
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN not set, cannot comment on PR")
    return false
  }

  const res = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: comment }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`GitHub API error: ${res.status}`, body)
    return false
  }

  return true
}
