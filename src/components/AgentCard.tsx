"use client"

import { useState } from "react"
import Link from "next/link"
import Markdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { useQueryClient } from "@tanstack/react-query"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { usePRStatus, usePRComments, type PRCommentsResponse, type PRReactions } from "@/hooks/useAgents"
import type { Agent, AgentStatus } from "@/lib/schemas"

const statusConfig: Record<AgentStatus, { className: string; dot: string }> = {
  CREATING: { className: "bg-blue-500/20 text-blue-400 border-blue-500/30", dot: "bg-blue-400" },
  RUNNING: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", dot: "bg-yellow-400 animate-pulse" },
  FINISHED: { className: "bg-green-500/20 text-green-400 border-green-500/30", dot: "bg-green-400" },
  STOPPED: { className: "bg-gray-500/20 text-gray-400 border-gray-500/30", dot: "bg-gray-400" },
  ERROR: { className: "bg-red-500/20 text-red-400 border-red-500/30", dot: "bg-red-400" },
  EXPIRED: { className: "bg-orange-500/20 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
}

const prStatusConfig = {
  open: { className: "bg-green-500/20 text-green-400 border-green-500/30", label: "Open" },
  merged: { className: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Merged" },
  closed: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: "Closed" },
}


const reactionEmojis: Record<keyof PRReactions, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  hooray: "🎉",
  confused: "😕",
  heart: "❤️",
  rocket: "🚀",
  eyes: "👀",
}

function CompactReactions({ reactions }: { reactions: PRReactions }) {
  const activeReactions = Object.entries(reactions).filter(([, count]) => count > 0)
  if (activeReactions.length === 0) return null

  return (
    <span className="inline-flex gap-1 ml-2">
      {activeReactions.slice(0, 4).map(([key, count]) => (
        <span key={key} className="text-xs">
          {reactionEmojis[key as keyof PRReactions]}{count > 1 && count}
        </span>
      ))}
    </span>
  )
}

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  const [isFetching, setIsFetching] = useState(false)
  const queryClient = useQueryClient()
  const status = statusConfig[agent.status]
  const { data: prInfo } = usePRStatus(agent.target.prUrl)
  
  const isClosedPR = prInfo && (prInfo.status === "merged" || prInfo.status === "closed")
  
  const { data: prComments } = usePRComments(agent.target.prUrl, { enabled: false })
  const lastComment = prComments?.comments?.at(-1)
  const needsManualFetch = !prComments && agent.target.prUrl

  const handleFetchComments = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!agent.target.prUrl) return
    setIsFetching(true)
    try {
      const res = await fetch(`/api/pr-comments?url=${encodeURIComponent(agent.target.prUrl)}`)
      if (res.ok) {
        const data: PRCommentsResponse = await res.json()
        queryClient.setQueryData(["pr-comments", agent.target.prUrl], data)
      }
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="cursor-pointer transition-colors hover:bg-accent/50 h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-medium truncate">
              {agent.name}
            </CardTitle>
            <Badge variant="outline" className={`${status.className} flex items-center gap-1.5 shrink-0`}>
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              {agent.status}
            </Badge>
          </div>
          <CardDescription className="text-sm truncate">
            {agent.source.repository.replace("github.com/", "")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p className="truncate">
              <span className="text-muted-foreground/60">Branch:</span> {agent.target.branchName}
            </p>
            {agent.target.prUrl && (
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-primary hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(agent.target.prUrl, "_blank", "noopener,noreferrer")
                  }}
                >
                  PR #{agent.target.prUrl.split("/").pop()}
                </span>
                {prInfo && (
                  <>
                    <Badge variant="outline" className={`${prStatusConfig[prInfo.status].className} text-xs`}>
                      {prStatusConfig[prInfo.status].label}
                    </Badge>
                    <span className="text-muted-foreground/50 text-xs">
                      {dayjs(prInfo.updatedAt).fromNow()}
                    </span>
                  </>
                )}
              </div>
            )}
            {needsManualFetch ? (
              <div className="mt-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchComments}
                  disabled={isFetching}
                  className="w-full"
                >
                  {isFetching ? "Loading..." : "Load comments"}
                </Button>
              </div>
            ) : lastComment ? (
              <div className="mt-2 border-t pt-2">
                <div className="text-xs text-muted-foreground/50 mb-1">
                  {lastComment.user} · {dayjs(lastComment.createdAt).fromNow()}
                  <CompactReactions reactions={lastComment.reactions} />
                </div>
                <div className="text-muted-foreground/70 prose prose-sm prose-invert max-w-none overflow-auto max-h-64">
                  <Markdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      a: ({ href, children }) => (
                        <span
                          className="text-primary hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (href) window.open(href, "_blank", "noopener,noreferrer")
                          }}
                        >
                          {children}
                        </span>
                      ),
                    }}
                  >
                    {lastComment.body}
                  </Markdown>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
