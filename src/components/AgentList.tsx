"use client"

import { useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAgents, usePRStatuses, useBatchPRComments } from "@/hooks/useAgents"
import { AgentCard } from "./AgentCard"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { CreateIssueDialog } from "./CreateIssueDialog"

export function AgentList() {
  const [showAll, setShowAll] = useState(false)
  const [hideExpired, setHideExpired] = useState(true)
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch, isFetching } = useAgents()
  const { prInfoMap: prStatuses, isLoading: prLoading } = usePRStatuses(data?.agents)

  // Sort and filter agents
  const filteredAgents = useMemo(() => {
    if (!data?.agents) return []
    return data.agents
      .filter((agent) => {
        if (hideExpired && agent.status === "EXPIRED") return false
        if (!showAll && agent.target.prUrl) {
          const prInfo = prStatuses.get(agent.target.prUrl)
          if (prInfo && prInfo.status !== "open") return false
        }
        return true
      })
      .sort((a, b) => {
        const aTime = a.target.prUrl ? prStatuses.get(a.target.prUrl)?.updatedAt : null
        const bTime = b.target.prUrl ? prStatuses.get(b.target.prUrl)?.updatedAt : null
        const aDate = new Date(aTime || a.createdAt).getTime()
        const bDate = new Date(bTime || b.createdAt).getTime()
        return bDate - aDate
      })
  }, [data?.agents, prStatuses, showAll, hideExpired])

  // Fetch PR comments for agents with open PRs
  const openPrUrls = useMemo(() => {
    if (prLoading) return []
    return filteredAgents
      .filter((a) => {
        if (!a.target.prUrl) return false
        const prInfo = prStatuses.get(a.target.prUrl)
        return prInfo?.status === "open"
      })
      .map((a) => a.target.prUrl!)
  }, [filteredAgents, prStatuses, prLoading])
  const { fetchedCount, total, isLoading: commentsLoading, refetch: refetchComments } = useBatchPRComments(openPrUrls)

  const repos = useMemo(() => {
    const repoSet = new Set<string>()
    data?.agents.forEach((agent) => {
      if (agent.source.repository) {
        repoSet.add(agent.source.repository)
      }
    })
    return Array.from(repoSet).sort()
  }, [data?.agents])

  const handleRefresh = async () => {
    try {
      await refetch()
      queryClient.invalidateQueries({ queryKey: ["pr-status"] })
      // Clear PR comments cache then refetch
      queryClient.removeQueries({ queryKey: ["pr-comments"] })
      refetchComments()
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading agents...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        Error: {error.message}
      </div>
    )
  }

  if (!data?.agents.length) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No agents found
      </div>
    )
  }

  const hiddenCount = data.agents.length - filteredAgents.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filteredAgents.length} agent{filteredAgents.length !== 1 ? "s" : ""}
            {hiddenCount > 0 && !showAll && ` (${hiddenCount} hidden)`}
          </span>
          {(prLoading || commentsLoading) && (
            <span className="text-xs text-muted-foreground/50 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
              {prLoading 
                ? "Loading PR status..." 
                : `Loading comments (${fetchedCount}/${total})...`}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching || commentsLoading}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
          <CreateIssueDialog repos={repos} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={hideExpired} onCheckedChange={setHideExpired} />
            Hide expired
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showAll} onCheckedChange={setShowAll} />
            Show merged/closed
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
