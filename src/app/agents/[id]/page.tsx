"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Markdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGemoji from "remark-gemoji"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)
import { useAgent, useDeleteAgent, usePRStatus, useMarkPRReady, usePRCommits } from "@/hooks/useAgents"
import { ConversationPanel } from "@/components/ConversationPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  draft: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Draft" },
  open: { className: "bg-green-500/20 text-green-400 border-green-500/30", label: "Open" },
  merged: { className: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Merged" },
  closed: { className: "bg-red-500/20 text-red-400 border-red-500/30", label: "Closed" },
}

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [reviewRequested, setReviewRequested] = useState(false)
  const [requestingReview, setRequestingReview] = useState(false)
  const [refreshingComments, setRefreshingComments] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: agent, isLoading, error } = useAgent(id)
  const { data: prInfo } = usePRStatus(agent?.target.prUrl)
  const markReadyMutation = useMarkPRReady(agent?.target.prUrl)
  const { data: prCommits } = usePRCommits(agent?.target.prUrl)
  const deleteMutation = useDeleteAgent(id)

  const handleCopyCheckout = () => {
    const branch = agent?.target.branchName
    if (!branch) return
    const cmd = `if ! git diff --quiet || ! git diff --cached --quiet; then echo "⚠️ Uncommitted changes detected. Stash or commit first."; else git fetch origin && git checkout -B ${branch} origin/${branch}; fi`
    navigator.clipboard.writeText(cmd)
    toast.success("Checkout command copied", {
      description: `git checkout ${branch}`,
    })
  }

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

  const handleRefreshComments = async () => {
    setRefreshingComments(true)
    try {
      if (agent?.target.prUrl) {
        await queryClient.invalidateQueries({ queryKey: ["pr-comments", agent.target.prUrl] })
      }
      toast.success("Comments refreshed")
    } finally {
      setRefreshingComments(false)
    }
  }

  const handleMarkReady = () => {
    markReadyMutation.mutate(undefined, {
      onSuccess: () => toast.success("PR marked ready for review"),
      onError: () => toast.error("Failed to mark PR ready"),
    })
  }

  const handleDelete = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setDeleteOpen(false)
        toast.success("Agent deleted")
        router.push("/")
      },
      onError: () => {
        toast.error("Failed to delete agent")
      },
    })
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
  const mergeableLabel = prInfo
    ? prInfo.status !== "open"
      ? "N/A"
      : prInfo.mergeable === true
        ? "Yes"
        : prInfo.mergeable === false
          ? "No"
          : "Unknown"
    : null
  const mergeableState =
    prInfo?.status === "open" && prInfo.mergeableState
      ? prInfo.mergeableState.replace(/_/g, " ")
      : null

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
              {prInfo && (() => {
                const displayStatus = prInfo.draft ? "draft" : prInfo.status
                return (
                  <>
                    <Badge variant="outline" className={prStatusConfig[displayStatus].className}>
                      {prStatusConfig[displayStatus].label}
                    </Badge>
                    {prInfo.draft && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={handleMarkReady}
                        disabled={markReadyMutation.isPending}
                      >
                        {markReadyMutation.isPending ? "Marking..." : "Mark Ready"}
                      </Button>
                    )}
                  </>
                )
              })()}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {agent.source.repository.replace("github.com/", "")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {agent.target.prUrl && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={agent.target.prUrl} target="_blank" rel="noopener noreferrer">
                    View PR
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`${agent.target.prUrl}/files`} target="_blank" rel="noopener noreferrer">
                    View Changes
                  </a>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={agent.target.url} target="_blank" rel="noopener noreferrer">
                View in Cursor
              </a>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete agent?</DialogTitle>
            <DialogDescription>
              This will permanently delete {agent.name}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid lg:grid-cols-[1fr_700px] gap-6 h-full">
          {/* Agent Details */}
          <div className="space-y-4 overflow-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Branch:</span>{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">{agent.target.branchName}</code>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleCopyCheckout}>
                    Copy checkout
                  </Button>
                </div>
                <div>
                  <span className="text-muted-foreground">Source ref:</span>{" "}
                  {agent.source.ref || "default"}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {new Date(agent.createdAt).toLocaleString()}
                </div>
                {prInfo && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Mergeable:</span>{" "}
                    <span>{mergeableLabel}</span>
                    {mergeableState && (
                      <span className="text-muted-foreground/60 text-xs">({mergeableState})</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {agent.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Summary</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-xs prose-invert max-w-none overflow-x-auto text-sm">
                  <Markdown remarkPlugins={[remarkGemoji]} rehypePlugins={[rehypeRaw]}>{agent.summary}</Markdown>
                </CardContent>
              </Card>
            )}

            {prCommits?.commits && prCommits.commits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Commits
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({prCommits.commits.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {prCommits.commits.map((commit) => (
                    <div key={commit.sha} className="flex items-baseline gap-2 text-sm">
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground hover:text-primary shrink-0"
                      >
                        {commit.sha.slice(0, 7)}
                      </a>
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate flex-1 hover:text-primary"
                        title={commit.message}
                      >
                        {commit.message}
                      </a>
                      <span className="text-xs text-muted-foreground/50 shrink-0">
                        {dayjs(commit.date).fromNow()}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>

          {/* Conversation */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 border-b shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">PR Comments</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleRefreshComments}
                    disabled={refreshingComments}
                    title="Refresh Comments"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingComments ? "animate-spin" : ""}`} />
                  </Button>
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
              </div>
            </CardHeader>
            <div className="flex-1 overflow-hidden">
              <ConversationPanel prUrl={agent.target.prUrl} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
