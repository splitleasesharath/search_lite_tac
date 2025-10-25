#!/bin/bash
# Deploy Index Lite to Cloudflare Pages

set -e

echo "🚀 Deploying Index Lite to Cloudflare Pages..."

# Navigate to repo root to load .env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Check for required environment variables
if [ -z "$CLOUDFLARE_PAGES_PROJECT_NAME" ]; then
    echo "❌ Error: CLOUDFLARE_PAGES_PROJECT_NAME not set in .env"
    exit 1
fi

# Build first
echo "📦 Building Index Lite..."
./scripts/build.sh

# Navigate to the index_lite app directory
cd apps/index_lite

# Deploy using wrangler
if command -v wrangler &> /dev/null; then
    echo "🌍 Deploying to Cloudflare Pages..."
    wrangler pages deploy dist --project-name="$CLOUDFLARE_PAGES_PROJECT_NAME"
    echo "✅ Deployment complete!"
else
    echo "❌ Error: wrangler CLI not found"
    echo "Install with: npm install -g wrangler"
    exit 1
fi
