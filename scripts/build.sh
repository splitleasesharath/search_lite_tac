#!/bin/bash
# Build Index Lite for production deployment

set -e

echo "🏗️  Building Index Lite for production..."

# Navigate to the index_lite app directory
cd "$(dirname "$0")/../apps/index_lite"

# Check if package.json exists and has build script
if [ -f "package.json" ]; then
    # Use the build script from package.json
    if command -v npm &> /dev/null; then
        echo "📦 Running npm build..."
        npm run build 2>/dev/null || npm run build-windows 2>/dev/null || {
            echo "⚠️  No build script found, copying files manually..."
            mkdir -p dist
            cp index.html styles.css script.js dist/
            cp -r assets dist/ 2>/dev/null || true
        }
    else
        echo "⚠️  npm not found, copying files manually..."
        mkdir -p dist
        cp index.html styles.css script.js dist/
        cp -r assets dist/ 2>/dev/null || true
    fi
else
    echo "⚠️  No package.json found, copying files manually..."
    mkdir -p dist
    cp index.html styles.css script.js dist/
    cp -r assets dist/ 2>/dev/null || true
fi

echo "✅ Build complete! Output in apps/index_lite/dist/"
ls -lh dist/
