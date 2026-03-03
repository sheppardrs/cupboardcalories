#!/bin/bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Starting NutriTrack VLM Server..."
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "Error: Ollama is not installed"
    echo "Install from: https://ollama.com"
    exit 1
fi

# Pull the model if not already installed
if ! ollama list | grep -q "qwen3-vl"; then
    echo "Pulling qwen3-vl:2b model (this may take a few minutes)..."
    ollama pull qwen3-vl:2b
    echo ""
fi

# Start the VLM server
echo "Starting VLM server on port 5000..."
node server/vlm-server.js &
VLM_PID=$!

echo "VLM server started (PID: $VLM_PID)"
echo ""

# Wait for VLM server to be ready
echo "Waiting for VLM server..."
sleep 2

# Start Next.js
echo "Starting Next.js..."
npm run dev

# Cleanup on exit
trap "kill $VLM_PID 2>/dev/null" EXIT
