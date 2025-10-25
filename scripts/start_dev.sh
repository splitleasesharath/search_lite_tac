#!/bin/bash
# Start local development server for Index Lite

set -e

echo "🚀 Starting Index Lite Development Server..."

# Navigate to the index_lite app directory
cd "$(dirname "$0")/../apps/index_lite"

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "📡 Server starting at http://127.0.0.1:8000"
    echo "📂 Serving: $(pwd)"
    echo "🛑 Press Ctrl+C to stop"
    echo ""
    python3 -m http.server 8000 --bind 127.0.0.1
elif command -v python &> /dev/null; then
    echo "📡 Server starting at http://127.0.0.1:8000"
    echo "📂 Serving: $(pwd)"
    echo "🛑 Press Ctrl+C to stop"
    echo ""
    python -m http.server 8000 --bind 127.0.0.1
else
    echo "❌ Python not found. Please install Python 3 to run the dev server."
    exit 1
fi
