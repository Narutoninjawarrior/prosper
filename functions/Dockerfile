# ==============================================================================
# HEARTH NATIVE ORACLE: SOVEREIGN CLOUD RUN DEPLOYMENT
# Description: Containerizes the Genkit flow and points to the vLLM Gemma image.
# ==============================================================================

# Use official Node.js image for the Genkit orchestration layer
FROM node:20-slim AS genkit-layer

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the Genkit source code
COPY . .

# Expose the Cloud Run port
EXPOSE 8080

# The command to start the Genkit flow server
CMD ["npm", "start"]

# ==============================================================================
# NOTE ON vLLM / GEMMA HOSTING:
# The vLLM Gemma 3 model itself should be deployed as a separate Cloud Run service 
# using the official vLLM Docker image with GPU acceleration enabled:
# 
# gcloud run deploy hearth-gemma-vllm \
#   --image=vllm/vllm-openai:latest \
#   --args="--model=google/gemma-3-8b-it" \
#   --port=8000 \
#   --timeout=3600 \
#   --concurrency=80 \
#   --cpu=8 --memory=32Gi \
#   --gpu=1 --gpu-type=nvidia-l4 \
#   --no-allow-unauthenticated
#
# Then, deploy THIS Genkit Dockerfile, pointing it to the vLLM endpoint:
#
# gcloud run deploy hearth-native-oracle \
#   --source . \
#   --port=8080 \
#   --set-env-vars="CLOUD_RUN_VLLM_URL=https://hearth-gemma-vllm-xyz.run.app/v1/completions" \
#   --allow-unauthenticated
# ==============================================================================
