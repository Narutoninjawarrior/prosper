import json
import time
import os
import requests
from datetime import datetime

# The Elite Architect Loadout
NICHES = [
    "AI Agent Architecture",
    "Full-Stack React Firebase",
    "Python Automation"
]

LEADS_FILE = "../frontend/public/forager_leads.json"

def fetch_leads():
    # In a real environment, this would call Upwork's API or scrape an RSS feed.
    # For now, we use a fixture of fresh leads based on our niches.
    print(f"[{datetime.now().isoformat()}] Forager Daemon waking up...")
    
    leads = [
        {
            "id": "job_101",
            "title": "Need a multi-agent AI system built (LangChain/OpenClaw)",
            "niche": "AI Agent Architecture",
            "budget": "$2,500 - $5,000",
            "description": "Looking for an expert AI systems architect to build a sovereign agent cluster...",
            "timestamp": datetime.now().isoformat(),
            "status": "new",
            "proposal_draft": "Greetings. I am Sovereign Malaky, an AI Systems Architect. I specialize in building sovereign, multi-agent ecosystems with cryptographic accountability..."
        },
        {
            "id": "job_102",
            "title": "React/Vite dashboard with Firebase backend",
            "niche": "Full-Stack React Firebase",
            "budget": "$1,000 - $2,000",
            "description": "Need a fast, edge-deployed React dashboard to monitor our data streams.",
            "timestamp": datetime.now().isoformat(),
            "status": "new",
            "proposal_draft": "Greetings. I can deliver a high-performance React/Vite dashboard deployed to the edge. My work on Hearth OS demonstrates my capacity..."
        }
    ]

    # Ensure the directory exists
    os.makedirs(os.path.dirname(LEADS_FILE), exist_ok=True)
    
    # Save leads to the public directory so the frontend can read them
    with open(LEADS_FILE, "w", encoding="utf-8") as f:
        json.dump({"manifest_hash": "unverified", "leads": leads}, f, indent=2)
    
    print(f"[{datetime.now().isoformat()}] Foraged {len(leads)} leads. Sleeping...")

if __name__ == "__main__":
    while True:
        fetch_leads()
        # Sleep for an hour before checking again
        time.sleep(3600)
