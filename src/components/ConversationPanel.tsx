"use client"

import Markdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { usePRComments } from "@/hooks/useAgents"
import { FollowupForm } from "./FollowupForm"

interface ConversationPanelProps {
  agentId: string
  prUrl?: string
}

export function ConversationPanel({ agentId, prUrl }: ConversationPanelProps) {
  const { data, isLoading, error } = usePRComments(prUrl, { refetch: true })

  if (!prUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No PR linked
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading comments...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Error: {error.message}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          {data?.comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg p-3 bg-muted"
            >
              <div className="text-xs text-muted-foreground mb-1">
                <span className={comment.isBot ? "text-blue-400" : ""}>{comment.user}</span>
                {" · "}
                {new Date(comment.createdAt).toLocaleString()}
              </div>
              <div className="text-sm prose prose-sm prose-invert max-w-none overflow-x-auto">
                <Markdown rehypePlugins={[rehypeRaw]}>{comment.body}</Markdown>
              </div>
            </div>
          ))}
          {!data?.comments.length && (
            <div className="text-center text-muted-foreground">
              No comments yet
            </div>
          )}
        </div>
      </div>
      <FollowupForm agentId={agentId} />
    </div>
  )
}
