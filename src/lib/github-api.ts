export type PRStatus = "open" | "merged" | "closed"

export interface PRInfo {
  status: PRStatus
  title: string
  number: number
  updatedAt: string
  draft: boolean
}

const ISSUE_MAP_KEY = "agentIssueMap"

// Store mapping of repo+branchPrefix to issue URL
export function storeIssueMapping(repo: string, issueUrl: string, issueTitle: string) {
  if (typeof window === "undefined") return
  try {
    const map = JSON.parse(localStorage.getItem(ISSUE_MAP_KEY) || "{}")
    // Key by repo and simplified title (first few words)
    const titleKey = issueTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)
    map[`${repo}:${titleKey}`] = issueUrl
    localStorage.setItem(ISSUE_MAP_KEY, JSON.stringify(map))
  } catch {}
}

// Try to find issue URL from stored mappings based on agent name
export function findStoredIssueUrl(repo: string, agentName: string): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const map = JSON.parse(localStorage.getItem(ISSUE_MAP_KEY) || "{}")
    const nameKey = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)
    // Try to find a matching key
    for (const [key, url] of Object.entries(map)) {
      if (key.startsWith(`${repo}:`) && nameKey.includes(key.split(":")[1].slice(0, 20))) {
        return url as string
      }
    }
  } catch {}
  return undefined
}

// Derive issue URL from agent data
export function deriveIssueUrl(agent: { name: string; source: { repository: string; issueUrl?: string } }): string | undefined {
  if (agent.source.issueUrl) return agent.source.issueUrl
  return findStoredIssueUrl(agent.source.repository, agent.name)
}

export function parsePrUrl(prUrl: string): { owner: string; repo: string; number: number } | null {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

export function parseIssueUrl(issueUrl: string): { owner: string; repo: string; number: number } | null {
  const match = issueUrl.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
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
      cache: "no-store",
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
    draft: data.draft ?? false,
  }
}

export interface PRReactions {
  "+1": number
  "-1": number
  laugh: number
  hooray: number
  confused: number
  heart: number
  rocket: number
  eyes: number
}

export interface PRComment {
  id: number
  user: string
  body: string
  createdAt: string
  isBot: boolean
  reactions: PRReactions
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
    reactions: {
      "+1": comment.reactions?.["+1"] ?? 0,
      "-1": comment.reactions?.["-1"] ?? 0,
      laugh: comment.reactions?.laugh ?? 0,
      hooray: comment.reactions?.hooray ?? 0,
      confused: comment.reactions?.confused ?? 0,
      heart: comment.reactions?.heart ?? 0,
      rocket: comment.reactions?.rocket ?? 0,
      eyes: comment.reactions?.eyes ?? 0,
    },
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

export async function fetchIssueComments(issueUrl: string): Promise<PRComment[] | null> {
  const parsed = parseIssueUrl(issueUrl)
  if (!parsed) {
    console.error("Failed to parse issue URL:", issueUrl)
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
    reactions: {
      "+1": comment.reactions?.["+1"] ?? 0,
      "-1": comment.reactions?.["-1"] ?? 0,
      laugh: comment.reactions?.laugh ?? 0,
      hooray: comment.reactions?.hooray ?? 0,
      confused: comment.reactions?.confused ?? 0,
      heart: comment.reactions?.heart ?? 0,
      rocket: comment.reactions?.rocket ?? 0,
      eyes: comment.reactions?.eyes ?? 0,
    },
  }))
}

export async function markPRReadyForReview(prUrl: string): Promise<boolean> {
  const parsed = parsePrUrl(prUrl)
  if (!parsed) {
    console.error("Failed to parse PR URL:", prUrl)
    return false
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN not set")
    return false
  }

  // First get the PR node ID via REST API
  const prRes = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  )

  if (!prRes.ok) {
    console.error("Failed to fetch PR:", await prRes.text())
    return false
  }

  const prData = await prRes.json()
  const nodeId = prData.node_id

  // Use GraphQL to mark ready for review
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation { markPullRequestReadyForReview(input: { pullRequestId: "${nodeId}" }) { pullRequest { isDraft } } }`,
    }),
  })

  if (!res.ok) {
    console.error("GraphQL error:", await res.text())
    return false
  }

  const result = await res.json()
  return !result.errors
}

export interface PRCommit {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

export async function fetchPRCommits(prUrl: string): Promise<PRCommit[] | null> {
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
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/commits?per_page=100`,
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

  return data.map((commit: any) => ({
    sha: commit.sha,
    message: commit.commit.message.split("\n")[0], // First line only
    author: commit.commit.author?.name || commit.author?.login || "Unknown",
    date: commit.commit.author?.date || "",
    url: commit.html_url,
  }))
}

export async function commentOnIssue(issueUrl: string, comment: string): Promise<boolean> {
  const parsed = parseIssueUrl(issueUrl)
  if (!parsed) {
    console.error("Failed to parse issue URL:", issueUrl)
    return false
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error("GITHUB_TOKEN not set, cannot comment on issue")
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
