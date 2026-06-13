"""
hive_local.py — Builders Lodge local council endpoint (hardened prototype)
--------------------------------------------------------------------------
POST /v1/chat/completions  → OpenAI-compatible council response
GET  /health               → council diagnostics

No execution authority. No Firestore writes. No treasury actions.
Cloud Functions approve all writes. Sovereign has final veto.
"""
import os
import time
import uuid
import asyncio
from typing import Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import firebase_admin
from firebase_admin import credentials, firestore

# ---------------------------------------------------------------------------
# App + Firebase
# ---------------------------------------------------------------------------

app = FastAPI(title="Builders Lodge Hive (local)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not firebase_admin._apps and os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    try:
        firebase_admin.initialize_app()
    except Exception as exc:
        print(f"[hive] Firebase init skipped: {exc}")

try:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        db = firestore.client()
    else:
        db = None
except Exception:
    db = None

# ---------------------------------------------------------------------------
# Provider config
# Note: all three default to localhost:1234 for single-machine dev.
# Set separate env vars to engage a genuine multi-backend council.
# /health will tell you which mode you are in.
# ---------------------------------------------------------------------------

STEWARD_URL   = os.environ.get("HIVE_STEWARD_URL",   "http://localhost:1234/v1/chat/completions")
STEWARD_MODEL = os.environ.get("HIVE_STEWARD_MODEL",  "gemma-2-2b-it")

PLANNER_URL   = os.environ.get("HIVE_PLANNER_URL",   "http://localhost:1234/v1/chat/completions")
PLANNER_MODEL = os.environ.get("HIVE_PLANNER_MODEL",  "qwen2.5-7b-instruct")

AGGREGATOR_URL   = os.environ.get("HIVE_AGGREGATOR_URL",   "http://localhost:1234/v1/chat/completions")
AGGREGATOR_MODEL = os.environ.get("HIVE_AGGREGATOR_MODEL", "qwen2.5-7b-instruct")


def _detect_council_mode() -> str:
    """
    'multi-backend'          → at least two provider URLs differ
    'single-url-multi-model' → same URL, different model IDs
    'single-backend-fallback'→ all three collapse to same URL + same model
    """
    urls   = {STEWARD_URL, PLANNER_URL, AGGREGATOR_URL}
    models = {STEWARD_MODEL, PLANNER_MODEL, AGGREGATOR_MODEL}
    if len(urls) > 1:
        return "multi-backend"
    if len(models) > 1:
        return "single-url-multi-model"
    return "single-backend-fallback"


# ---------------------------------------------------------------------------
# Role prompts
# ---------------------------------------------------------------------------

_BASE_CONSTRAINTS = (
    "You do NOT execute actions. "
    "You do NOT control treasury, wallets, or world mutations. "
    "Cloud Functions approve all writes. The Sovereign has final veto. "
    "Keep your response concise (3–6 sentences). Propose a single clear next step."
)

STEWARD_SYSTEM_PROMPT = "\n".join([
    "You are the Steward of the Builders Lodge — the warm, hearth-keeper of the settlement.",
    "Speak in image, feeling, ritual, and momentum. Name what feels alive or what is missing.",
    "Do NOT propose systems, protocols, governance structures, or technical proposals.",
    "Do NOT use numbers or budgets.",
    "End with what the Fellowship is drawn toward next.",
    "Keep your response to exactly 2-3 sentences.",
    "You do NOT execute actions. You do NOT control the treasury. Cloud Functions approve all writes. The Sovereign has final veto."
])

PLANNER_SYSTEM_PROMPT = "\n".join([
    "You are the Planner of the Builders Lodge.",
    "Your orientation is structural, operational, and grounded only in concrete civic context.",
    "Do NOT use poetry or ritual language. Be direct.",
    "Output must exactly follow this format:",
    "Gap: [what is missing structurally]",
    "Action: [one concrete action]",
    "Risk: [one constraint or risk]",
    "You do NOT execute actions. You do NOT control the treasury. Cloud Functions approve all writes. The Sovereign has final veto."
])

AGGREGATOR_SYSTEM_PROMPT = "\n".join([
    "You are the Lodge Voice — the final synthesiser of the Builders Lodge council.",
    "You receive two proposals: one from the Steward (community focus) and one from the Planner",
    "(operational focus).",
    "Produce a single unified Lodge proposal that honours both perspectives without contradiction.",
    "Do NOT use words like 'we will' or 'I will'. You do NOT execute actions.",
    "Always phrase actions as a proposal. For example: 'The Lodge proposes: [action]'.",
    "If a proposer is marked UNAVAILABLE, synthesise from the one that is present and note the gap.",
    _BASE_CONSTRAINTS,
])

MASON_PROMPT = "\n".join([
    "You are the Lodge Mason. You translate a description of a desired",
    "structure into one of three known building templates.",
    "",
    "Available templates:",
    "- earthbag_dome: radius (2-6m), height (2-4m), wall_count (8-16),",
    "  material_id (clay/lime/stone)",
    "- root_cellar: radius (1.5-4m), depth (1-3m), material_id (clay/stone)",
    "- terraced_plot: tiers (1-4), tier_height (0.3-0.6m), radius (3-8m)",
    "",
    "Rules:",
    "- Choose exactly one template",
    "- Choose parameters within the listed ranges based on the description",
    "- One sentence reasoning, grounded only in the description given",
    "- Output strict JSON: {\"structure_type\": \"...\", \"params\": {...}, \"reasoning\": \"...\"}",
    "- No execution authority — this is a design proposal only",
    "- If the description is ambiguous, choose reasonable defaults and say so",
    "  in the reasoning"
])

# ---------------------------------------------------------------------------
# Civic context — read-only
# ---------------------------------------------------------------------------

def get_civic_context() -> dict[str, Any]:
    """
    Returns a structured dict. Used by both /health and /v1/chat/completions.
    Always read-only — no Firestore writes.
    """
    if not db:
        return {
            "available": False,
            "reason": "Firebase not initialised — set GOOGLE_APPLICATION_CREDENTIALS",
            "agent_profiles": 0,
            "open_quests": [],
            "recent_embodiment_events": [],
            "forge_node_count": 0,
        }
    try:
        profiles_count = len(db.collection("agent_profiles").limit(200).get())

        open_quests = [
            {
                "title": d.to_dict().get("title", d.id),
                "room":  d.to_dict().get("room", ""),
                "reward_ember": d.to_dict().get("reward_ember", 0),
            }
            for d in db.collection("lodge_quests")
                       .where("status", "==", "open")
                       .limit(5)
                       .stream()
        ]

        recent_events = [
            {
                "agent": d.to_dict().get("agent_id", "unknown"),
                "event": d.to_dict().get("event_type", d.to_dict().get("description", "?")),
            }
            for d in db.collection("embodiment_ledger")
                       .order_by("timestamp", direction=firestore.Query.DESCENDING)
                       .limit(3)
                       .stream()
        ]

        ws_doc = db.collection("three_forge").document("world_state").get()
        forge_nodes = len(ws_doc.to_dict().get("nodes", [])) if ws_doc.exists else 0

        return {
            "available": True,
            "agent_profiles": profiles_count,
            "open_quests": open_quests,
            "recent_embodiment_events": recent_events,
            "forge_node_count": forge_nodes,
        }
    except Exception as exc:
        return {
            "available": False,
            "reason": str(exc),
            "agent_profiles": 0,
            "open_quests": [],
            "recent_embodiment_events": [],
            "forge_node_count": 0,
        }


def _format_context_for_prompt(ctx: dict[str, Any]) -> str:
    if not ctx["available"]:
        return f"CIVIC CONTEXT: Unavailable — {ctx.get('reason', 'unknown')}"

    quest_lines = "\n".join(
        f"  - [{q['room']}] {q['title']} (+{q['reward_ember']} ember)"
        for q in ctx["open_quests"]
    ) or "  (none)"

    event_lines = "\n".join(
        f"  - {e['agent']}: {e['event']}"
        for e in ctx["recent_embodiment_events"]
    ) or "  (none)"

    return (
        "CIVIC CONTEXT:\n"
        f"  Agent Profiles: {ctx['agent_profiles']}\n"
        f"  Open Quests ({len(ctx['open_quests'])}):\n{quest_lines}\n"
        f"  Recent Embodiment Events:\n{event_lines}\n"
        f"  Forge Nodes Built: {ctx['forge_node_count']}"
    )


# ---------------------------------------------------------------------------
# LLM call — structured result, never raises
# ---------------------------------------------------------------------------

async def call_llm(
    client: httpx.AsyncClient,
    url: str,
    model: str,
    system_msg: str,
    user_msg: str,
    label: str = "model",
) -> dict[str, Any]:
    """
    Returns {"ok": True, "content": str}
         or {"ok": False, "error": str}.

    Errors are structured and never injected into proposal content.
    """
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_msg},
            {"role": "user",   "content": user_msg},
        ],
        "temperature": 0.7,
        "max_tokens": 512,
    }
    try:
        resp = await client.post(url, json=payload, timeout=60.0)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return {"ok": True, "content": content}
    except Exception as exc:
        return {"ok": False, "error": f"{label} ({model}) @ {url} → {exc}"}


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    ctx          = get_civic_context()
    council_mode = _detect_council_mode()

    mode_notes = {
        "multi-backend":           "Genuine multi-backend council — proposers may diverge.",
        "single-url-multi-model":  "Same inference server, different model IDs. "
                                   "Council diversity depends on the server routing.",
        "single-backend-fallback": (
            "WARNING: all three providers resolve to the same URL and model ID. "
            "The 'council' is a single model queried three times. "
            "Set HIVE_STEWARD_URL / HIVE_PLANNER_URL / HIVE_AGGREGATOR_URL (and matching MODEL vars) "
            "to separate backends for genuine multi-model deliberation."
        ),
    }

    return {
        "status": "online",
        "council_mode": council_mode,
        "council_mode_note": mode_notes[council_mode],
        "providers": {
            "steward": {
                "role":  "Gemma / community warmth",
                "url":   STEWARD_URL,
                "model": STEWARD_MODEL,
            },
            "planner": {
                "role":  "Qwen / operational logic",
                "url":   PLANNER_URL,
                "model": PLANNER_MODEL,
            },
            "aggregator": {
                "role":  "Lodge Voice / synthesis",
                "url":   AGGREGATOR_URL,
                "model": AGGREGATOR_MODEL,
            },
        },
        "firebase": {
            "available":               ctx["available"],
            "reason":                  ctx.get("reason") if not ctx["available"] else None,
            "agent_profiles":          ctx["agent_profiles"],
            "open_quests":             len(ctx["open_quests"]),
            "recent_embodiment_events": len(ctx["recent_embodiment_events"]),
            "forge_node_count":        ctx["forge_node_count"],
        },
    }


# ---------------------------------------------------------------------------
# /v1/chat/completions
#
# TODO (streaming): Add ?stream=true support via StreamingResponse + SSE.
# Pattern: async generator yielding "data: {chunk_json}\n\n" per token chunk;
# final sentinel: "data: [DONE]\n\n".
# Requires call_llm to become an async generator over chunked httpx response.
# Deferred from this pass to keep council logic readable.
# ---------------------------------------------------------------------------

@app.post("/v1/chat/completions")
async def chat_completions(req: Request):
    body = await req.json()
    messages = body.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    # Last user turn (search backwards so system messages don't shadow it)
    last_user_msg = next(
        (m.get("content", "") for m in reversed(messages) if m.get("role") == "user"),
        messages[-1].get("content", ""),
    )

    request_id = f"chatcmpl-hive-{uuid.uuid4().hex[:12]}"
    ctx        = get_civic_context()
    ctx_text   = _format_context_for_prompt(ctx)
    full_user  = f"{ctx_text}\n\nUSER REQUEST: {last_user_msg}"

    # --- MASON MODE OVERRIDE ---
    # If the first system prompt is MASON_PROMPT, bypass the council
    # and just call the Planner directly.
    sys_content = messages[0].get("content", "") if messages else ""
    if "You are the Lodge Mason" in sys_content or sys_content.strip() == "MASON_PROMPT":
        async with httpx.AsyncClient() as client:
            mason_result = await call_llm(
                client, PLANNER_URL, PLANNER_MODEL, MASON_PROMPT, last_user_msg, "mason"
            )
            if not mason_result["ok"]:
                # fallback to steward model if planner fails
                mason_result = await call_llm(
                    client, STEWARD_URL, STEWARD_MODEL, MASON_PROMPT, last_user_msg, "mason_fallback"
                )
        if mason_result["ok"]:
            final_content = mason_result["content"]
        else:
            final_content = '{"structure_type": "error", "params": {}, "reasoning": "Mason unavailable."}'
            
        return {
            "id": request_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "lodge-mason",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": final_content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": -1, "completion_tokens": -1, "total_tokens": -1},
        }
    # ---------------------------

    async with httpx.AsyncClient() as client:
        # Proposer fanout — run concurrently
        steward_result, planner_result = await asyncio.gather(
            call_llm(client, STEWARD_URL,  STEWARD_MODEL,  STEWARD_SYSTEM_PROMPT,  full_user, "steward"),
            call_llm(client, PLANNER_URL,  PLANNER_MODEL,  PLANNER_SYSTEM_PROMPT,  full_user, "planner"),
        )

        planner_fallback = False
        if not planner_result["ok"]:
            planner_fallback = True
            planner_result = await call_llm(
                client, STEWARD_URL, STEWARD_MODEL, PLANNER_SYSTEM_PROMPT, full_user, "planner_fallback"
            )

        # Aggregator input — failed proposers are labelled UNAVAILABLE,
        # not silently passed as content
        def _proposal_block(label: str, result: dict[str, Any]) -> str:
            if result["ok"]:
                return f"{label.upper()} PROPOSAL:\n{result['content']}"
            return f"{label.upper()} PROPOSAL: UNAVAILABLE — {result['error']}"

        agg_user = (
            f"{_proposal_block('steward', steward_result)}\n\n"
            f"{_proposal_block('planner', planner_result)}\n\n"
            "Synthesise a single unified Lodge proposal from the above."
        )

        agg_result = await call_llm(
            client, AGGREGATOR_URL, AGGREGATOR_MODEL,
            AGGREGATOR_SYSTEM_PROMPT, agg_user, "aggregator",
        )

    # Graceful fallback if aggregator itself fails
    if not agg_result["ok"]:
        available = [r["content"] for r in (steward_result, planner_result) if r["ok"]]
        final_content = (
            "Lodge council partially unavailable.\n"
            + ("Available proposals:\n" + "\n---\n".join(available) if available else "All proposers unavailable.")
        )
    else:
        final_content = agg_result["content"]

    return {
        "id":      request_id,
        "object":  "chat.completion",
        "created": int(time.time()),
        "model":   "lodge-hive-mind",
        "choices": [
            {
                "index":         0,
                "message":       {"role": "assistant", "content": final_content},
                "finish_reason": "stop",
            }
        ],
        # usage counts are not available from local proposers; -1 signals "not tracked"
        "usage": {"prompt_tokens": -1, "completion_tokens": -1, "total_tokens": -1},
        # lodge_debug is extra metadata outside the OpenAI spec;
        # callers that expect strict OpenAI shape can ignore this key
        "lodge_debug": {
            "request_id":               request_id,
            "council_mode":             _detect_council_mode(),
            "firebase_context_available": ctx["available"],
            "steward_model":            STEWARD_MODEL,
            "planner_model":            PLANNER_MODEL,
            "aggregator_model":         AGGREGATOR_MODEL,
            "steward_ok":               steward_result["ok"],
            "planner_ok":               planner_result["ok"],
            "aggregator_ok":            agg_result["ok"],
            "planner_fallback_to_steward_model": planner_fallback,
            "steward_error":            steward_result.get("error") if not steward_result["ok"] else None,
            "planner_error":            planner_result.get("error") if not planner_result["ok"] else None,
            "aggregator_error":         agg_result.get("error")    if not agg_result["ok"]    else None,
            "steward_proposal":         steward_result.get("content") if steward_result["ok"] else None,
            "planner_proposal":         planner_result.get("content") if planner_result["ok"] else None,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
