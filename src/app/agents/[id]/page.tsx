"use client"

import { use, useState } from "react"
import Link from "next/link"
import Markdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { useAgent, usePRStatus, usePRComments } from "@/hooks/useAgents"
import { ConversationPanel } from "@/components/ConversationPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AgentStatus } from "@/lib/schemas"

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

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [reviewRequested, setReviewRequested] = useState(false)
  const [requestingReview, setRequestingReview] = useState(false)
  const { data: agent, isLoading, error } = useAgent(id)
  const { data: prInfo } = usePRStatus(agent?.target.prUrl)
  const { data: prComments } = usePRComments(agent?.target.prUrl)
  
  const lastComment = prComments?.comments?.at(-1)

  const handleRequestCodexReview = async () => {
    if (!agent?.target.prUrl) return
    setRequestingReview(true)
    try {
      const res = await fetch("/api/pr-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prUrl: agent.target.prUrl,
          comment: "@codex review this PR",
        }),
      })
      if (res.ok) {
        setReviewRequested(true)
      }
    } finally {
      setRequestingReview(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading agent...
      </main>
    )
  }

  if (error || !agent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">Error loading agent</p>
        <Link href="/">
          <Button variant="outline">← Back to agents</Button>
        </Link>
      </main>
    )
  }

  const status = statusConfig[agent.status]

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <header className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">← Back</Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold truncate">{agent.name}</h1>
              <Badge variant="outline" className={`${status.className} flex items-center gap-1.5 shrink-0`}>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {agent.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {agent.source.repository.replace("github.com/", "")}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_700px] gap-6 h-full">
          {/* Agent Details */}
          <div className="space-y-4 overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Branch:</span>{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">{agent.target.branchName}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">Source ref:</span>{" "}
                  {agent.source.ref || "default"}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {new Date(agent.createdAt).toLocaleString()}
                </div>
                {agent.target.prUrl && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={agent.target.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      PR #{agent.target.prUrl.split("/").pop()} →
                    </a>
                    <a
                      href={`${agent.target.prUrl}/files`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Changes →
                    </a>
                    {prInfo && (
                      <Badge variant="outline" className={prStatusConfig[prInfo.status].className}>
                        {prStatusConfig[prInfo.status].label}
                      </Badge>
                    )}
                  </div>
                )}
                <div>
                  <a
                    href={agent.target.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View in Cursor →
                  </a>
                </div>
              </CardContent>
            </Card>

            {agent.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-xs prose-invert max-w-none overflow-x-auto text-sm">
                  <Markdown rehypePlugins={[rehypeRaw]}>{agent.summary}</Markdown>
                </CardContent>
              </Card>
            )}

            {lastComment && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Latest Comment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-2">
                    {lastComment.user} · {new Date(lastComment.createdAt).toLocaleString()}
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none overflow-x-auto">
                    <Markdown rehypePlugins={[rehypeRaw]}>{lastComment.body}</Markdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Conversation */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 border-b shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">PR Comments</CardTitle>
                {agent.target.prUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestCodexReview}
                    disabled={requestingReview || reviewRequested}
                  >
                    {reviewRequested ? "Review Requested" : requestingReview ? "Requesting..." : "Request Codex Review"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <div className="flex-1 overflow-hidden">
              <ConversationPanel agentId={id} prUrl={agent.target.prUrl} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
