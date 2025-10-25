#!/bin/bash
# Start the GitHub webhook listener

set -e

echo "🎣 Starting GitHub Webhook Listener..."

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "⚠️  Warning: .env file not found, using defaults"
fi

# Check authentication mode (max branch: API key is optional)
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ℹ️  ANTHROPIC_API_KEY not set - using authenticated Claude Code (Max Plan)"
    echo "ℹ️  If you see authentication errors, set ANTHROPIC_API_KEY in .env"
else
    echo "ℹ️  Using ANTHROPIC_API_KEY for authentication"
fi

# Start the webhook server
echo "📡 Webhook server starting on port ${PORT:-8001}..."
echo "🔗 Endpoint: http://localhost:${PORT:-8001}/gh-webhook"
echo "❤️  Health check: http://localhost:${PORT:-8001}/health"
echo "🛑 Press Ctrl+C to stop"
echo ""

uv run adws/adw_triggers/trigger_webhook.py
