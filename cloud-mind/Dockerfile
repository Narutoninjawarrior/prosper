# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.11-slim

# Set the working directory to /app
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Make sure the app listens on the PORT environment variable
# Cloud Run provides the PORT environment variable.
# Default to 8080 if not set.
ENV PORT=8080

# Run the web service on container startup.
# Use gunicorn for production, but for simplicity we use uvicorn.
# For Cloud Run, we recommend using gunicorn with uvicorn workers.
# However, to keep it simple and fast-starting, we use uvicorn directly.
# Note: For higher concurrency, consider using gunicorn.
CMD exec uvicorn main:app --host 0.0.0.0 --port $PORT