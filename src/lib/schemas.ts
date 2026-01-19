import { z } from "zod"

export const AgentStatusSchema = z.enum(["CREATING", "RUNNING", "FINISHED", "STOPPED", "ERROR", "EXPIRED"])

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: AgentStatusSchema,
  source: z.object({ repository: z.string(), ref: z.string().optional() }),
  target: z.object({
    branchName: z.string(),
    url: z.string(),
    prUrl: z.string().optional(),
    autoCreatePr: z.boolean().optional().default(false),
    openAsCursorGithubApp: z.boolean().optional(),
    skipReviewerRequest: z.boolean().optional(),
  }),
  summary: z.string().optional(),
  createdAt: z.string(),
})

export const MessageSchema = z.object({
  id: z.string(),
  type: z.enum(["user_message", "assistant_message"]),
  text: z.string(),
})

export const AgentsResponseSchema = z.object({
  agents: z.array(AgentSchema),
  nextCursor: z.string().optional(),
})

export const ConversationResponseSchema = z.object({
  messages: z.array(MessageSchema),
})

export const FollowupRequestSchema = z.object({
  message: z.string().min(1),
})

// Infer types from schemas
export type Agent = z.infer<typeof AgentSchema>
export type AgentStatus = z.infer<typeof AgentStatusSchema>
export type Message = z.infer<typeof MessageSchema>
export type AgentsResponse = z.infer<typeof AgentsResponseSchema>
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>
