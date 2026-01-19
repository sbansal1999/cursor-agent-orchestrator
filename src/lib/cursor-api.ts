import {
  AgentsResponseSchema,
  ConversationResponseSchema,
  type AgentsResponse,
  type ConversationResponse,
} from "./schemas"

const CURSOR_API_BASE = "https://api.cursor.com/v0"

function getAuthHeader(): string {
  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey) {
    throw new Error("CURSOR_API_KEY environment variable is not set")
  }
  return `Basic ${Buffer.from(apiKey + ":").toString("base64")}`
}

async function fetchCursorAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${CURSOR_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Cursor API error (${response.status}): ${error}`)
  }

  return response.json()
}

export async function listAgents(cursor?: string): Promise<AgentsResponse> {
  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  const query = params.toString()
  const data = await fetchCursorAPI(`/agents${query ? `?${query}` : ""}`)
  return AgentsResponseSchema.parse(data)
}

export async function getAgent(id: string): Promise<AgentsResponse["agents"][0]> {
  const data = await fetchCursorAPI(`/agents/${id}`)
  return data as AgentsResponse["agents"][0]
}

export async function getConversation(agentId: string): Promise<ConversationResponse> {
  const data = await fetchCursorAPI(`/agents/${agentId}/conversation`)
  return ConversationResponseSchema.parse(data)
}

export async function sendFollowup(agentId: string, message: string): Promise<void> {
  await fetchCursorAPI(`/agents/${agentId}/followup`, {
    method: "POST",
    body: JSON.stringify({ prompt: { text: message } }),
  })
}
