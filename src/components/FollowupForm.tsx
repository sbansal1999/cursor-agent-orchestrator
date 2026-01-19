"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useFollowup } from "@/hooks/useAgents"

interface FollowupFormProps {
  agentId: string
}

export function FollowupForm({ agentId }: FollowupFormProps) {
  const [message, setMessage] = useState("")
  const { mutate, isPending } = useFollowup(agentId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    mutate(message.trim(), {
      onSuccess: () => setMessage(""),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Send a follow-up message..."
        className="min-h-[60px] resize-none"
        disabled={isPending}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            handleSubmit(e)
          }
        }}
      />
      <Button type="submit" disabled={isPending || !message.trim()}>
        {isPending ? "Sending..." : "Send"}
      </Button>
    </form>
  )
}
