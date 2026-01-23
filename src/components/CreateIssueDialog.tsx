"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { storeIssueMapping } from "@/lib/github-api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface CreateIssueDialogProps {
  repos: string[]
}

export function CreateIssueDialog({ repos }: CreateIssueDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [repo, setRepo] = useLocalStorage("createIssue.lastRepo", "")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [assignToCursor, setAssignToCursor] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!repo || !title) {
      setError("Repository and title are required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, title, description, assignToCursor }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create issue")
      }

      const data = await res.json()
      
      // Store mapping for later lookup
      storeIssueMapping(repo, data.url, title)
      
      // Show success toast with link
      toast.success("Issue created", {
        description: `#${data.number}: ${title}`,
        action: {
          label: "Open",
          onClick: () => window.open(data.url, "_blank"),
        },
      })
      
      // Refresh agents list
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      
      // Reset form and close dialog (keep repo selection)
      setTitle("")
      setDescription("")
      setAssignToCursor(true)
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error("Failed to create issue", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Create Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription>
            Create a new GitHub issue and optionally assign it to Cursor agent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="repo">Repository</Label>
            <Select value={repo} onValueChange={setRepo}>
              <SelectTrigger id="repo">
                <SelectValue placeholder="Select a repository" />
              </SelectTrigger>
              <SelectContent>
                {repos.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Issue description (optional)"
              className="min-h-[120px] max-h-[300px] overflow-y-auto resize-y"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="assignToCursor"
              checked={assignToCursor}
              onCheckedChange={(checked) => setAssignToCursor(checked === true)}
            />
            <Label htmlFor="assignToCursor" className="cursor-pointer">
              Assign to Cursor agent
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
