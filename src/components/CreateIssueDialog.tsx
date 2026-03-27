"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRepoBranches } from "@/hooks/useAgents"
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
  const [baseBranch, setBaseBranch] = useState("")
  const [branchType, setBranchType] = useState("")
  const [jiraTicket, setJiraTicket] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: branchesData, isLoading: branchesLoading } = useRepoBranches(repo)

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
        body: JSON.stringify({
          repo,
          title,
          description,
          assignToCursor,
          baseBranch: baseBranch || undefined,
          branchType: branchType || undefined,
          jiraTicket: jiraTicket || undefined,
        }),
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
      setBaseBranch("")
      setBranchType("")
      setJiraTicket("")
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      toast.error("Failed to create issue", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRepoChange = (value: string) => {
    setRepo(value)
    setBaseBranch("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Create Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
          <DialogDescription>
            Create a GitHub issue and optionally assign it to a Cursor agent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="repo">Repository</Label>
            <Select value={repo} onValueChange={handleRepoChange}>
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
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Issue description (optional)"
              className="min-h-[100px] max-h-[250px] overflow-y-auto resize-y"
            />
          </div>

          {/* Base Branch + Branch Type + Jira — single row */}
          <div className={`grid gap-3 ${repo ? "grid-cols-3" : "grid-cols-2"}`}>
            {repo && (
              <div className="grid gap-1.5">
                <Label htmlFor="base-branch">Base Branch</Label>
                <Select value={baseBranch || "__default__"} onValueChange={(value) => setBaseBranch(value === "__default__" ? "" : value)}>
                  <SelectTrigger id="base-branch" className="w-full">
                    <SelectValue placeholder={branchesLoading ? "Loading..." : "Default branch"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Default branch</SelectItem>
                    {branchesData?.branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="branch-type">Branch Type</Label>
              <Select
                value={branchType || "__default__"}
                onValueChange={(value) => setBranchType(value === "__default__" ? "" : value)}
              >
                <SelectTrigger id="branch-type" className="w-full">
                  <SelectValue placeholder="No preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">No preference</SelectItem>
                  <SelectItem value="feat">feat</SelectItem>
                  <SelectItem value="fix">fix</SelectItem>
                  <SelectItem value="chore">chore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="jira-ticket">Jira Ticket</Label>
              <Input
                id="jira-ticket"
                value={jiraTicket}
                onChange={(e) => setJiraTicket(e.target.value.toUpperCase())}
                placeholder="ABC-123"
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <div className="flex items-center gap-2 mr-auto">
            <Checkbox
              id="assignToCursor"
              checked={assignToCursor}
              onCheckedChange={(checked) => setAssignToCursor(checked === true)}
            />
            <Label htmlFor="assignToCursor" className="cursor-pointer text-sm text-muted-foreground">
              Assign to Cursor agent
            </Label>
          </div>
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
