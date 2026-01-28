"use client"

import { useRef, useEffect } from "react"
import Markdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import { usePRComments, type PRReactions, type PRComment } from "@/hooks/useAgents"
import { FollowupForm } from "./FollowupForm"

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

function Reactions({ reactions }: { reactions: PRReactions }) {
  const activeReactions = Object.entries(reactions).filter(([, count]) => count > 0)
  if (activeReactions.length === 0) return null

  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {activeReactions.map(([key, count]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-xs bg-muted-foreground/10 rounded-full px-2 py-0.5"
        >
          {reactionEmojis[key as keyof PRReactions]} {count}
        </span>
      ))}
    </div>
  )
}

function CommentList({ comments, isLoading, error }: { 
  comments: PRComment[] | undefined
  isLoading: boolean
  error: Error | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [comments])

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
    <div ref={scrollRef} className="flex-1 overflow-auto p-4">
      <div className="space-y-4">
        {comments?.map((comment) => (
          <div key={comment.id} className="rounded-lg p-3 bg-muted">
            <div className="text-xs text-muted-foreground mb-1">
              <span className={comment.isBot ? "text-blue-400" : ""}>{comment.user}</span>
              {" · "}
              {new Date(comment.createdAt).toLocaleString()}
            </div>
            <div className="text-sm prose prose-sm prose-invert max-w-none overflow-x-auto">
              <Markdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{comment.body}</Markdown>
            </div>
            <Reactions reactions={comment.reactions} />
          </div>
        ))}
        {!comments?.length && (
          <div className="text-center text-muted-foreground">
            No comments yet
          </div>
        )}
      </div>
    </div>
  )
}

interface ConversationPanelProps {
  prUrl?: string
}

export function ConversationPanel({ prUrl }: ConversationPanelProps) {
  const { data, isLoading, error } = usePRComments(prUrl, { refetch: true, enabled: !!prUrl })

  if (!prUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No PR linked
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CommentList 
        comments={data?.comments} 
        isLoading={isLoading} 
        error={error} 
      />
      <FollowupForm prUrl={prUrl} />
    </div>
  )
}
