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

export type PRComment = {
  id: number
  user: string
  body: string
  createdAt: string
  isBot: boolean
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

export function useBatchPRComments(prUrls: string[]) {
  const queryClient = useQueryClient()
  const [fetchedCount, setFetchedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchInBatches = useCallback(async (urls: string[]) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    setFetchedCount(0)
    setIsLoading(true)

    const toFetch = urls.filter(
      (url) => !queryClient.getQueryData<PRCommentsResponse>(["pr-comments", url])
    )
    const alreadyCached = urls.length - toFetch.length
    setFetchedCount(alreadyCached)

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

  const urlsKey = prUrls.join(",")
  useEffect(() => {
    if (prUrls.length > 0) {
      fetchInBatches(prUrls)
    } else {
      setIsLoading(false)
    }
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  return { fetchedCount, total: prUrls.length, isLoading }
}

export type PRInfo = { status: "open" | "merged" | "closed"; title: string; number: number; updatedAt: string }

export function usePRStatus(prUrl: string | undefined) {
  return useQuery<PRInfo>({
    queryKey: ["pr-status", prUrl],
    queryFn: () => fetchJSON(`/api/pr-status?url=${encodeURIComponent(prUrl!)}`),
    enabled: !!prUrl,
    staleTime: 60000,
  })
}

export function usePRStatuses(agents: Agent[] | undefined) {
  const prUrls = agents?.map((a) => a.target.prUrl).filter((url): url is string => !!url) ?? []
  
  const queries = useQueries({
    queries: prUrls.map((url) => ({
      queryKey: ["pr-status", url],
      queryFn: () => fetchJSON<PRInfo>(`/api/pr-status?url=${encodeURIComponent(url)}`),
      staleTime: 60000,
    })),
  })

  const prInfoMap = new Map<string, PRInfo>()
  queries.forEach((q, i) => {
    if (q.data) {
      prInfoMap.set(prUrls[i], q.data)
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
