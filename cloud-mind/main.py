from fastapi import FastAPI
from google.cloud import firestore
import os
import logging

# Initialize FastAPI app
app = FastAPI(title="Builders Lodge Mind", description="Gemma/Qwen inference engine for the Hearthlands")

# Initialize Firestore client
# It will use the default credentials provided by the environment.
db = firestore.Client()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    return {"status": "healthy"}

@app.post("/tick")
async def tick():
    """
    Endpoint to be triggered by Cloud Scheduler or an authenticated Firebase Function.
    This is where the agent will read context and decide the next Hearthlands action.
    """
    logger.info("Received tick request")
    
    # TODO: Read from Firestore collections: world_state, agent_profiles, embodiment_ledger
    # Example:
    # world_state_ref = db.collection('world_state').document('current')
    # world_state = world_state_ref.get()
    
    # For now, return a placeholder response.
    return {
        "status": "tick received",
        "message": "The Builders Lodge Mind is awake. No action taken yet.",
        "timestamp": firestore.SERVER_TIMESTAMP
    }

# Note: In a real implementation, we would add model inference logic here.
# For now, we are stubbing the endpoint.

@app.post("/ask")
async def ask(payload: dict):
    """
    Endpoint for the public Lodge Mind relay.
    Expects an OpenAI-compatible messages array.
    """
    logger.info(f"Received ask request: {payload}")
    
    messages = payload.get("messages", [])
    prompt = messages[-1]["content"] if messages else "No prompt provided."

    # TODO: In a real implementation, this would query the Gemma/Qwen model.
    # For now, we return a simulated response demonstrating the RAG context.
    
    simulated_response = (
        f"The Sovereign Hearth acknowledges your query: '{prompt}'. "
        "I am currently operating in prototype relay mode. Once my weights are fully loaded "
        "into the Cloud Run GPU environment, I will provide a synthesized civic directive."
    )

    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": simulated_response
                }
            }
        ],
        "lodge_debug": {
            "steward_proposal": "Simulated Steward: Acknowledge the query and await full deployment.",
            "planner_proposal": "Simulated Planner: Ensure the user knows the cloud mind is in readiness state."
        }
    }

if __name__ == "__main__":
    # This block is for local development only.
    # In Cloud Run, the container is started by the CMD in the Dockerfile.
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))