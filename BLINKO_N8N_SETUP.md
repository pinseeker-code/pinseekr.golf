# Blinko → n8n → Ollama Setup Guide

## Architecture
```
Blinko (Umbrel) → n8n (Umbrel) → Ollama (Laptop via Tailscale) → Response back
```

## Step 1: Import Workflow into n8n

1. Open n8n on Umbrel (usually `http://umbrel.local:5678` or `http://umbrel.technitium:5678`)
2. Click **Workflows** → **Add workflow** → **Import from File**
3. Select `blinko-n8n-ollama-workflow.json`
4. The workflow will open with 3 nodes: Webhook → Forward to Ollama → Respond to Webhook

## Step 2: Configure Ollama URL

1. Get your laptop's Tailscale IP:
   ```powershell
   ipconfig | Select-String "100\."
   ```

2. In the n8n workflow, click the **"Forward to Ollama"** node
3. Replace `YOUR_LAPTOP_TAILSCALE_IP` with your actual Tailscale IP
   - Example: `http://100.64.1.42:11434/api/generate`
4. Verify the model name (`llama3.2` or whatever you have installed)

## Step 3: Save and Activate Workflow

1. Click **Save** (top right)
2. Toggle the workflow to **Active** (switch in top right should turn green)
3. Note the webhook URL shown in the Webhook node (example):
   ```
   http://umbrel.technitium:5678/webhook/blinko-capture
   ```

## Step 4: Test from PowerShell

```powershell
Invoke-RestMethod -Uri 'http://umbrel.technitium:5678/webhook/blinko-capture' -Method Post -ContentType 'application/json' -Body '{"prompt":"What is the capital of France?","model":"llama3.2"}'
```

Expected: JSON response with Ollama's generated text.

Check n8n executions (click **Executions** in sidebar) to see the flow:
- Webhook received the POST
- Forward to Ollama sent request to laptop
- Response returned to webhook caller

## Step 5: Configure Blinko

1. Open Blinko settings (Umbrel)
2. Find **AI Configuration** or **Custom LLM Endpoint**
3. Change from direct Ollama URL to:
   ```
   http://umbrel.local:5678/webhook/blinko-capture
   ```
   OR if using Technitium DNS:
   ```
   http://umbrel.technitium:5678/webhook/blinko-capture
   ```

4. Save settings

## Step 6: Test End-to-End

1. In Blinko, create a new note with AI assistance
2. Watch n8n Executions panel — you should see:
   - Blinko POST received
   - Request forwarded to Ollama on laptop
   - Response sent back to Blinko

## Troubleshooting

### Ollama not responding
```powershell
# On laptop, ensure Ollama is listening on all interfaces
$env:OLLAMA_HOST = "0.0.0.0:11434"
ollama serve
```

Test from Umbrel (if you have shell access):
```bash
curl http://YOUR_LAPTOP_TAILSCALE_IP:11434/api/tags
```

### n8n webhook not triggering
- Verify workflow is **Active** (green toggle)
- Check n8n logs: Settings → Log Streaming
- Confirm Blinko is sending to correct URL

### Timeout errors
- Increase timeout in "Forward to Ollama" node → Options → Timeout (default: 30000ms)
- Check firewall on laptop allows port 11434

## What's Next?

With this working, you can extend the workflow:
- Add a **Code** node between Webhook and Ollama to transform/enrich prompts
- Add a **Set** node after Ollama to store responses in a database
- Add conditional logic (IF nodes) to route different types of notes
- Connect to other services (Notion, Obsidian, etc.)

---

# Phase 2: AI-Powered 2nd Brain

## Overview
Phase 2 builds a background AI loop that enriches your Blinko notes automatically:

**Flow**: Blinko note created → n8n captures → Ollama analyzes → enriched note saved back to Blinko

**What it does:**
- Auto-tags notes with AI-generated tags
- Creates summaries
- Extracts entities (people, places, projects)
- Suggests connections to other topics
- Stores analysis as a linked note in Blinko

## Setup

### Step 1: Import Phase 2 Workflow

1. Import `blinko-phase2-workflow.json` into n8n
2. The workflow has 5 nodes:
   - **Capture Blinko Note** (webhook)
   - **Extract Note Data** (code)
   - **Ollama Analysis** (HTTP request)
   - **Merge Analysis** (code)
   - **Save Enriched Note to Blinko** (HTTP request)

### Step 2: Configure Ollama URL

In **"Ollama Analysis"** node:
- Replace `YOUR_LAPTOP_TAILSCALE_IP` with your laptop's Tailscale IP
- Example: `http://100.64.1.42:11434/api/generate`
- Verify model name matches what you have (`qwen2.5:3b` or other)

### Step 3: Configure Blinko API Token

1. Get your Blinko API token:
   - Open Blinko → Settings → Basic Information
   - Copy your **API Token** (shown in the Token field)
   
2. In the n8n **"Save Enriched Note to Blinko"** node:
   - Click the node
   - Find the `Authorization` header parameter
   - Replace `YOUR_BLINKO_TOKEN` with your actual token
   - Result: `Bearer eyJhbGc...` (your token)

3. Verify the URL:
   - If Blinko runs on Umbrel: `http://localhost:3000/api/v1/note/upsert`
   - If accessing remotely: `http://umbrel.technitium:3000/api/v1/note/upsert`

### Step 4: Configure Blinko Webhook

Blinko has built-in webhook support! Configure it to notify n8n when notes are created:

1. In Blinko → Settings → Basic Information
2. Find **Webhook Endpoint** field
3. Enter: `http://localhost:5678/webhook/blinko-note-capture`
   - Or if n8n is on different machine: `http://<n8n-host>:5678/webhook/blinko-note-capture`
4. Save settings

**Webhook payload from Blinko:**
```json
{
  "data": { "id": 123, "content": "Note text", "type": 0, ... },
  "webhookType": "create",
  "activityType": "blinko.note.create"
}
```

### Step 5: Test

1. Activate the workflow in n8n
2. Create a test note in Blinko with content like:
   ```
   Meeting with Sarah about the Pinseekr tournament feature. 
   Need to implement leaderboard by March 15.
   ```
3. Check n8n Executions:
   - Should see webhook trigger
   - Ollama analysis with tags, summary, entities
   - Enriched note saved (or error if Blinko API not configured)

Expected AI output example:
```
🤖 AI Analysis:
📝 Discussion about implementing tournament leaderboard feature for Pinseekr with March deadline
🏷️ Tags: pinseekr, tournament, feature-request, deadline, meeting
👤 Entities: Sarah, Pinseekr
🔗 Related: project-management, software-development, deadlines
```

## Extending Phase 2

### Add Vector Database for Semantic Search
Replace the final node with **Pinecone** or **Qdrant** to store embeddings:
- Use Ollama's `/api/embeddings` endpoint
- Store note content + embeddings
- Query similar notes when creating new ones

### Add Context Retrieval
Before Ollama analysis, add a node that:
- Searches previous notes for related content
- Includes context in the Ollama prompt
- Creates better connections

### Multi-Model Analysis
Run multiple Ollama models in parallel:
- One for tagging
- One for summarization  
- One for entity extraction
- Merge results

### Scheduled Reports
Add a **Schedule Trigger** that:
- Runs daily/weekly
- Queries all notes from period
- Generates summary report with Ollama
- Posts to Blinko
