"use client"

import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AgentsResponse, Agent } from "@/lib/schemas"

const POLL_INTERVAL = 10000
async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useAgents() {
  return useQuery<AgentsResponse>({
    queryKey: ["agents"],
    queryFn: () => fetchJSON("/api/agents"),
    refetchInterval: POLL_INTERVAL,
  })
}

export function useAgent(id: string | null) {
  return useQuery<Agent>({
    queryKey: ["agent", id],
    queryFn: () => fetchJSON(`/api/agents/${id}`),
    enabled: !!id,
    refetchInterval: POLL_INTERVAL,
  })
}

export type PRReactions = {
  "+1": number
  "-1": number
  laugh: number
  hooray: number
  confused: number
  heart: number
  rocket: number
  eyes: number
}

export type PRComment = {
  id: number
  user: string
  body: string
  createdAt: string
  isBot: boolean
  reactions: PRReactions
}

type PRCommentsResponse = { comments: PRComment[] }

export function usePRComments(prUrl: string | undefined, options?: { refetch?: boolean; enabled?: boolean }) {
  return useQuery<PRCommentsResponse>({
    queryKey: ["pr-comments", prUrl],
    queryFn: () => fetchJSON(`/api/pr-comments?url=${encodeURIComponent(prUrl!)}`),
    enabled: (options?.enabled ?? true) && !!prUrl,
    staleTime: 60000,
    refetchInterval: options?.refetch ? POLL_INTERVAL : false,
  })
}

type PRInfo = {
  status: "open" | "merged" | "closed"
  title: string
  number: number
  updatedAt: string
  draft: boolean
  mergeable: boolean | null
  mergeableState: string | null
}

const MERGED_PRS_KEY = "cachedMergedPRs"

function getCachedMergedPRs(): Record<string, PRInfo> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(MERGED_PRS_KEY) || "{}")
  } catch {
    return {}
  }
}

function cacheMergedPR(url: string, info: PRInfo) {
  if (typeof window === "undefined") return
  try {
    const cached = getCachedMergedPRs()
    cached[url] = info
    localStorage.setItem(MERGED_PRS_KEY, JSON.stringify(cached))
  } catch {}
}

export function usePRStatus(prUrl: string | undefined) {
  return useQuery<PRInfo>({
    queryKey: ["pr-status", prUrl],
    queryFn: () => fetchJSON(`/api/pr-status?url=${encodeURIComponent(prUrl!)}`),
    enabled: !!prUrl,
    staleTime: 60000,
  })
}

export function usePRStatuses(agents: Agent[] | undefined) {
  const queryClient = useQueryClient()
  const prUrls = agents?.map((a) => a.target.prUrl).filter((url): url is string => !!url) ?? []
  const cachedMerged = getCachedMergedPRs()
  const urlsToFetch = prUrls.filter((url) => !cachedMerged[url])
  
  const queries = useQueries({
    queries: urlsToFetch.map((url) => ({
      queryKey: ["pr-status", url],
      queryFn: async () => {
        const data = await fetchJSON<PRInfo>(`/api/pr-status?url=${encodeURIComponent(url)}`)
        if (data.status === "merged" || data.status === "closed") {
          cacheMergedPR(url, data)
        }
        return data
      },
      staleTime: 60000,
    })),
  })

  const prInfoMap = new Map<string, PRInfo>()
  prUrls.forEach((url) => {
    if (cachedMerged[url]) {
      prInfoMap.set(url, cachedMerged[url])
      queryClient.setQueryData(["pr-status", url], cachedMerged[url])
    }
  })
  queries.forEach((q, i) => {
    if (q.data) {
      prInfoMap.set(urlsToFetch[i], q.data)
    }
  })

  const isLoading = queries.some((q) => q.isLoading)

  return { prInfoMap, isLoading }
}

export function useDeleteAgent(agentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchJSON(`/api/agents/${agentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      queryClient.removeQueries({ queryKey: ["agent", agentId] })
      queryClient.removeQueries({ queryKey: ["conversation", agentId] })
    },
  })
}

type PRCommit = {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

type PRCommitsResponse = { commits: PRCommit[] }

export function usePRCommits(prUrl: string | undefined) {
  return useQuery<PRCommitsResponse>({
    queryKey: ["pr-commits", prUrl],
    queryFn: () => fetchJSON(`/api/pr-commits?url=${encodeURIComponent(prUrl!)}`),
    enabled: !!prUrl,
    staleTime: 60000,
  })
}

export function useMarkPRReady(prUrl: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      fetchJSON("/api/pr-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pr-status", prUrl] })
    },
  })
}
