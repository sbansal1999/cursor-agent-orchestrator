"use client"

import Link from "next/link"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePRStatus } from "@/hooks/useAgents"
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

interface AgentCardProps {
  agent: Agent
}

export function AgentCard({ agent }: AgentCardProps) {
  const status = statusConfig[agent.status]
  const { data: prInfo } = usePRStatus(agent.target.prUrl)

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
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
