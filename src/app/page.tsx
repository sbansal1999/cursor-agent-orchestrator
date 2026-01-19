"use client"

import { AgentList } from "@/components/AgentList"
import { useAgents } from "@/hooks/useAgents"
import { useNotifications } from "@/hooks/useNotifications"

export default function Home() {
  const { data } = useAgents()
  useNotifications(data?.agents)

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Cursor Agent Orchestrator</h1>
      </header>
      <div className="flex-1 p-6">
        <AgentList />
      </div>
    </main>
  )
}
