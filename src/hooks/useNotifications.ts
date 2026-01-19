"use client"

import { useEffect, useRef, useCallback } from "react"
import type { Agent, AgentStatus } from "@/lib/schemas"

export function useNotifications(agents: Agent[] | undefined) {
  const prevStatusRef = useRef<Map<string, AgentStatus>>(new Map())

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") {
      await Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    requestPermission()
  }, [requestPermission])

  useEffect(() => {
    if (!agents || typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const prevStatuses = prevStatusRef.current

    for (const agent of agents) {
      const prevStatus = prevStatuses.get(agent.id)
      if (prevStatus && prevStatus !== agent.status) {
        if (agent.status === "FINISHED") {
          new Notification("Agent completed", {
            body: `${agent.name} has finished successfully`,
            icon: "/favicon.ico",
          })
        } else if (agent.status === "ERROR") {
          new Notification("Agent error", {
            body: `${agent.name} encountered an error`,
            icon: "/favicon.ico",
          })
        }
      }
    }

    const newStatuses = new Map<string, AgentStatus>()
    for (const agent of agents) {
      newStatuses.set(agent.id, agent.status)
    }
    prevStatusRef.current = newStatuses
  }, [agents])
}
