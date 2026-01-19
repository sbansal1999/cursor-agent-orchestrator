# Cursor Agent Orchestrator

A web dashboard for monitoring and interacting with [Cursor Background Agents](https://docs.cursor.com/background-agent/overview).

## Features

- View all running background agents and their status
- Read conversation history for each agent
- Send follow-up prompts to agents
- GitHub PR integration (status, comments)
- Browser notifications when agents complete

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create `.env.local` with your API keys:
   ```
   CURSOR_API_KEY=your_cursor_api_key
   GITHUB_TOKEN=your_github_token  # optional, for PR features
   ```

3. Run the dev server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)
