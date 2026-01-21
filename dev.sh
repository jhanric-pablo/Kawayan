#!/bin/bash

# Kill any existing processes on port 3000 and 3001
echo "Cleaning up existing processes..."
fuser -k 3000/tcp 2>/dev/null
fuser -k 3001/tcp 2>/dev/null

echo "Starting Local AI (Ollama)..."
ollama serve > /dev/null 2>&1 &
sleep 5

echo "Cleaning up old models..."
ollama rm qwen2:0.5b > /dev/null 2>&1
ollama rm qwen2.5:0.5b > /dev/null 2>&1

echo "Ensuring Local AI Model (qwen2.5:7b) is available... (This may take a while for the first run)"
ollama pull qwen2.5:7b

echo "Starting Kawayan AI (Backend + Frontend)..."

# Run the backend and frontend concurrently
npm run dev:full
