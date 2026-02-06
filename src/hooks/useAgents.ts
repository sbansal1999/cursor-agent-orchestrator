"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query"
import type { AgentsResponse, ConversationResponse, Agent } from "@/lib/schemas"

const POLL_INTERVAL = 10000
const BATCH_SIZE = 8

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

export function useConversation(agentId: string | null, options?: { refetch?: boolean; enabled?: boolean }) {
  return useQuery<ConversationResponse>({
    queryKey: ["conversation", agentId],
    queryFn: () => fetchJSON(`/api/agents/${agentId}/conversation`),
    enabled: (options?.enabled ?? true) && !!agentId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: options?.refetch ? POLL_INTERVAL : false,
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

export type PRCommentsResponse = { comments: PRComment[] }

export function usePRComments(prUrl: string | undefined, options?: { refetch?: boolean; enabled?: boolean }) {
  return useQuery<PRCommentsResponse>({
    queryKey: ["pr-comments", prUrl],
    queryFn: () => fetchJSON(`/api/pr-comments?url=${encodeURIComponent(prUrl!)}`),
    enabled: (options?.enabled ?? true) && !!prUrl,
    staleTime: 60000,
    refetchInterval: options?.refetch ? POLL_INTERVAL : false,
  })
}

export type IssueCommentsResponse = { comments: PRComment[] }

export function useIssueComments(issueUrl: string | undefined, options?: { refetch?: boolean; enabled?: boolean }) {
  return useQuery<IssueCommentsResponse>({
    queryKey: ["issue-comments", issueUrl],
    queryFn: () => fetchJSON(`/api/issue-comments?url=${encodeURIComponent(issueUrl!)}`),
    enabled: (options?.enabled ?? true) && !!issueUrl,
    staleTime: 60000,
    refetchInterval: options?.refetch ? POLL_INTERVAL : false,
  })
}

export function useBatchPRComments(prUrls: string[]) {
  const queryClient = useQueryClient()
  const [fetchedCount, setFetchedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchInBatches = useCallback(async (urls: string[]) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    const toFetch = urls.filter(
      (url) => !queryClient.getQueryData<PRCommentsResponse>(["pr-comments", url])
    )
    const alreadyCached = urls.length - toFetch.length

    // Only show loading if there's actually something to fetch
    if (toFetch.length === 0) {
      setFetchedCount(urls.length)
      setIsLoading(false)
      return
    }

    setFetchedCount(alreadyCached)
    setIsLoading(true)

    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      if (signal.aborted) break

      const batch = toFetch.slice(i, i + BATCH_SIZE)
      
      await Promise.allSettled(
        batch.map(async (prUrl) => {
          if (signal.aborted) throw new Error("Aborted")
          const data = await fetchJSON<PRCommentsResponse>(`/api/pr-comments?url=${encodeURIComponent(prUrl)}`)
          queryClient.setQueryData(["pr-comments", prUrl], data)
          setFetchedCount((c) => c + 1)
        })
      )
    }

    if (!signal.aborted) {
      setIsLoading(false)
    }
  }, [queryClient])

  const refetch = useCallback(() => {
    if (prUrls.length > 0) {
      fetchInBatches(prUrls)
    }
  }, [prUrls, fetchInBatches])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return { fetchedCount, total: prUrls.length, isLoading, refetch }
}

export type PRInfo = { status: "open" | "merged" | "closed"; title: string; number: number; updatedAt: string; draft: boolean }

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

export function useFollowup(agentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (message: string) =>
      fetchJSON(`/api/agents/${agentId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", agentId] })
      queryClient.invalidateQueries({ queryKey: ["agents"] })
    },
  })
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

export type PRCommit = {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

export type PRCommitsResponse = { commits: PRCommit[] }

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
