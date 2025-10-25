#!/bin/bash
# Start the cron-based task monitor

set -e

echo "⏰ Starting Cron Task Monitor..."

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Start the cron trigger
echo "👀 Monitoring tasks.md every ${CRON_POLLING_INTERVAL:-5} seconds..."
echo "🛑 Press Ctrl+C to stop"
echo ""

uv run adws/adw_triggers/trigger_cron.py --interval ${CRON_POLLING_INTERVAL:-5}
