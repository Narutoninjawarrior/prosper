# Lodge Hive Mind - Phase 1 Local Prototype

This prototype runs a local FastAPI server that exposes an OpenAI-compatible `/v1/chat/completions` endpoint. It acts as the "Lodge Mind" by fanning out user requests to two local models (Gemma and Qwen), reading civic context from Firestore, and having a final model synthesize the proposals.

## Setup

1. Make sure you have the required Python packages:
   ```bash
   pip install fastapi uvicorn httpx firebase-admin
   ```

2. Ensure your `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set so the server can securely read from the live Firestore.
   ```bash
   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your\serviceAccountKey.json
   ```

## Environment Variables

You can configure the endpoints and model names for the proposers and aggregator:

- `HIVE_PROPOSER_GEMMA_URL` (default: `http://localhost:1234/v1/chat/completions`)
- `HIVE_PROPOSER_GEMMA_MODEL` (default: `gemma-2-2b-it`)
- `HIVE_PROPOSER_QWEN_URL` (default: `http://localhost:1234/v1/chat/completions`)
- `HIVE_PROPOSER_QWEN_MODEL` (default: `qwen2.5-7b-instruct`)
- `HIVE_AGGREGATOR_URL` (default: `http://localhost:1234/v1/chat/completions`)
- `HIVE_AGGREGATOR_MODEL` (default: `qwen2.5-7b-instruct`)

## Run Command

Start the API server on port 8000:
```bash
python D:\Hearth\prosper2\cloud-mind\hive_local.py
```

## Health Check

To verify the context is loaded and models are configured:
```bash
curl http://localhost:8000/health
```

## Inference Test

Test the hive mind's ability to synthesize a proposal based on civic context:
```bash
curl -X POST http://localhost:8000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\": [{\"role\": \"user\", \"content\": \"What does the Fellowship need next?\"}]}"
```
