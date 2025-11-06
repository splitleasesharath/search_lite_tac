#!/bin/bash

# Setup script for Git merge driver and hooks
# Run this once per repository clone

set -e

echo "🔧 Setting up SplitLease dependency management tools..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -d ".git" ]; then
    echo "❌ Error: Run this script from the repository root"
    exit 1
fi

# Configure Git merge driver
echo "📦 Configuring Git merge driver for package-lock.json..."
git config --local merge.npm-merge-driver.name "NPM package-lock.json merge driver"
git config --local merge.npm-merge-driver.driver "node scripts/npm-merge-driver.js %O %A %B %P"

# Verify configuration
MERGE_DRIVER=$(git config --get merge.npm-merge-driver.driver)
if [ "$MERGE_DRIVER" = "node scripts/npm-merge-driver.js %O %A %B %P" ]; then
    echo "✓ Merge driver configured successfully"
else
    echo "❌ Failed to configure merge driver"
    exit 1
fi

# Setup pre-commit hook
echo ""
echo "🎣 Setting up pre-commit hook..."
if [ -f ".git/hooks/pre-commit" ]; then
    echo "⚠️  Warning: pre-commit hook already exists"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping pre-commit hook setup"
    else
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook to ensure package.json dependencies are sorted

node scripts/pre-commit-deps.js

exit $?
EOF
        chmod +x .git/hooks/pre-commit
        echo "✓ Pre-commit hook installed"
    fi
else
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Pre-commit hook to ensure package.json dependencies are sorted

node scripts/pre-commit-deps.js

exit $?
EOF
    chmod +x .git/hooks/pre-commit
    echo "✓ Pre-commit hook installed"
fi

# Check npm version
echo ""
echo "📊 Checking npm version..."
NPM_VERSION=$(npm --version)
NPM_MAJOR=$(echo $NPM_VERSION | cut -d. -f1)

if [ "$NPM_MAJOR" -ge 9 ] && [ "$NPM_MAJOR" -le 10 ]; then
    echo "✓ npm version $NPM_VERSION is compatible"
else
    echo "⚠️  Warning: npm version $NPM_VERSION detected"
    echo "   Recommended: npm 9.x or 10.x"
    echo "   Your version may cause lock file conflicts"
fi

# Make scripts executable
echo ""
echo "🔐 Making scripts executable..."
chmod +x scripts/sort-package-json.js
chmod +x scripts/npm-merge-driver.js
chmod +x scripts/pre-commit-deps.js
echo "✓ Scripts are executable"

# Test the setup
echo ""
echo "🧪 Testing dependency sorting..."
cd app/split-lease
if npm run deps:check 2>&1 | grep -q "properly sorted"; then
    echo "✓ Dependencies are properly sorted"
else
    echo "⚠️  Dependencies need sorting"
    echo "   Run: cd app/split-lease && npm run deps:sort"
fi
cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Read DEPENDENCY_MANAGEMENT.md for workflow guidelines"
echo "  2. Run 'cd app/split-lease && npm run deps:sort' to sort dependencies"
echo "  3. Install dependencies: npm install"
echo ""
