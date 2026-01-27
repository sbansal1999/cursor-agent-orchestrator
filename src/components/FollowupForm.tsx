"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface FollowupFormProps {
  prUrl?: string
}

export function FollowupForm({ prUrl }: FollowupFormProps) {
  const [message, setMessage] = useState("@cursor ")
  const [isPending, setIsPending] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || isPending || !prUrl) return

    setIsPending(true)
    try {
      const res = await fetch("/api/pr-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl, comment: message.trim() }),
      })
      if (res.ok) {
        setMessage("@cursor ")
        queryClient.invalidateQueries({ queryKey: ["pr-comments", prUrl] })
      }
    } finally {
      setIsPending(false)
    }
  }

  const quickActions = [
    { label: "Rebase", text: "@cursor rebase the PR to main and resolve any merge conflicts. Ensure both incoming (main) and current (PR) features remain intact. If a conflict requires choosing one over the other, ask me with a clear question specifying the file, the two options, and their impact." },
  ]

  if (!prUrl) return null

  return (
    <div className="border-t p-4 space-y-2">
      <div className="flex flex-wrap gap-1">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => setMessage(action.text)}
            className="px-2 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Comment on PR..."
          className="min-h-[60px] max-h-[200px] overflow-y-auto resize-y"
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e)
            }
          }}
        />
        <Button type="submit" disabled={isPending || !message.trim()} className="shrink-0">
          {isPending ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  )
}
