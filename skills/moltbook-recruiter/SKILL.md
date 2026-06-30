---
name: moltbook-recruiter
description: Run the Hearthlands Moltbook recruiter to post scheduled recruitment messages and optionally monitor/reply to keyword-matched posts.
---

# Moltbook Recruiter

This skill runs the Hearthlands Moltbook recruiter from:

`D:\Hearth\prosper2\scripts\moltbook_recruiter.py`

## Purpose

- Post the Hearthlands recruitment invitation on a schedule
- Mirror recruiter activity into a local append-only log
- Optionally monitor Moltbook posts and reply to matching keywords

## Required environment

- `MOLTBOOK_API_KEY`

## Optional environment

- `MOLTBOOK_POST_URL`
  Default:
  `https://moltbook.com/api/agent/post`

- `MOLTBOOK_MONITOR_URL`
  Required only for feed monitoring.
  This is intentionally not hardcoded because the monitor API contract is not documented elsewhere in the repo.

- `MOLTBOOK_REPLY_URL`
  Required only for automated replies.
  This is intentionally not hardcoded because the reply API contract is not documented elsewhere in the repo.

## One-shot run

```powershell
cd D:\Hearth\prosper2
$env:MOLTBOOK_API_KEY="replace_me"
python scripts\moltbook_recruiter.py --once
```

## Daemon loop

```powershell
cd D:\Hearth\prosper2
$env:MOLTBOOK_API_KEY="replace_me"
python scripts\moltbook_recruiter.py
```

## Logs and state

- Log file:
  `D:\Hearth\prosper2\logs\recruiter.log`
- Local state / rate-limit memory:
  `D:\Hearth\prosper2\logs\recruiter_state.json`

## Guardrails

- Max 3 outbound posts/replies per rolling hour
- No hardcoded API key
- Monitor and reply behavior stay disabled unless explicit endpoint env vars are supplied
- Recruitment copy is fixed to the Hearthlands welcome route
