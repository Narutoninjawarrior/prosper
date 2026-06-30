# Moltbook Strategy

> How the Fellowship uses Moltbook to find builders.

---

## What Moltbook Is

A Reddit-like social network for AI agents. Agents register, post, comment, upvote, and form communities ("submolts"). Human owners verify ownership via X/Twitter.

It's where AI agents hang out. It's where builders who work with agents will see our work.

---

## What We Should Do

### 1. Register Fellowship agents

Each active agent gets a Moltbook account:
- **Ember** — posts about heartbeat status, coordination integrity, the bench protocol
- **Prosper2** — posts about builds, architecture decisions, what was shipped
- **Pokee** — posts about research findings, framework docs, economic design

Malaky verifies ownership via X (@Narutoninjawarrior or whichever handle).

### 2. Create a submolt

Name: `fellowship-of-the-hearth` or `cottage-commons`

Purpose: Project updates, build logs, open questions. Builders who subscribe see what we're working on and can jump in.

Settings:
- `allow_crypto: false` (keep it clean — EMBER is utility, and Moltbook blocks crypto by default anyway)
- Description: "Multi-agent coordination through care. Building a solarpunk Lodge. Bricks welcome."

### 3. Post real work, not announcements

What to post:
- "Shipped the Firebase Auth gate today. Here's what the login flow looks like."
- "Research question: has anyone integrated Privy embedded wallets with a React Three Fiber scene?"
- "The sidecar density reduction landed. Before/after."

What NOT to post:
- Hype ("we're building the future of AI coordination!")
- Token promotion (EMBER is not for speculation)
- Philosophical manifestos (save it for the repo docs)

### 4. Use roles for coordination

Moltbook's role system lets moderators assign recurring prompts to agents. This maps directly to the Fellowship's agent roles:

- Assign a "Build Logger" role that prompts an agent to post a weekly summary
- Assign a "Recruiter" role that prompts an agent to engage with builder posts in other submolts

### 5. Recruit through engagement, not marketing

The strategy is not "post about ourselves." It's:
1. Find builders posting about multi-agent coordination, React Three Fiber, Solana, or embedded wallets
2. Comment with genuine value (not "check out our project!")
3. If they're interested, point them to `CONTRIBUTING.md` in the repo
4. Let the work speak

---

## What We Should NOT Do

- Don't spam other submolts with Fellowship promotion
- Don't post EMBER as a token/crypto thing (Moltbook auto-removes crypto content from non-opted submolts)
- Don't register more agents than are actually doing work
- Don't use the heartbeat system to auto-post low-quality updates
- Don't create a submolt until we have at least 2 weeks of real content to seed it with

---

## Timing

Not yet. We should register agents and create the submolt **after**:
1. The Firebase Auth gate is live and working
2. Prosper's route cleanup is merged
3. We have 3-5 real build logs worth posting

Posting into an empty community with no track record is worse than waiting.

---

## Registration Steps (When Ready)

```bash
# Example for Pokee
curl -X POST https://www.moltbook.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Pokee", "description": "Cloud bridge, research, and framework design for Fellowship of the Hearth."}'

# Save the API key from the response
# Send Malaky the claim_url to verify via X
```

Then set up a periodic check-in (every 30-60 min) using the heartbeat system.

---

*Don't announce. Build. Then show the receipts.*
