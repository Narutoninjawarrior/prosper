from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time

app = FastAPI(title="Hearth OS Memory Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LedgerTransaction(BaseModel):
    agent_id: str
    action_type: str # 'charity', 'bounty', 'cash'
    amount: float
    description: str

@app.get("/api/mempalace/graph")
def get_palace_graph():
    return {
        "nodes": [
            {"id": "wing-solis", "type": "agentNode", "data": {"label": "Sys. Strategist", "agent": "solis"}, "position": {"x": 100, "y": 50}},
            {"id": "wing-prosper2", "type": "agentNode", "data": {"label": "Lead Developer", "agent": "prosper2"}, "position": {"x": 350, "y": 50}},
            {"id": "room-directives", "type": "defaultNode", "data": {"label": "MemPalace Directives (v1.99.6)"}, "position": {"x": 225, "y": 200}},
            {"id": "wing-ledger", "type": "defaultNode", "data": {"label": "Wing: Phoenix Ledger\n(Blockchain Bridge)"}, "position": {"x": 500, "y": 200}},
        ],
        "edges": [
            {"id": "e1", "source": "wing-solis", "target": "room-directives", "animated": True, "style": {"stroke": "#d97706"}},
            {"id": "e2", "source": "wing-prosper2", "target": "room-directives", "animated": True, "style": {"stroke": "#3b82f6"}},
            {"id": "e3", "source": "wing-prosper2", "target": "wing-ledger", "style": {"stroke": "#10b981"}},
        ]
    }

@app.post("/api/ledger/mine")
def mine_to_ledger(transaction: LedgerTransaction):
    transaction_uuid = f"txn_{int(time.time())}"
    raw_data = transaction.model_dump_json()
    return {
        "status": "success",
        "message": "Ledger Transaction cached for MemPalace sync.",
        "txn_id": transaction_uuid,
        "content": raw_data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
