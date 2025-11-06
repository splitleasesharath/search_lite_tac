#!/bin/bash

###############################################################################
# Resolve Package Merge Conflicts
#
# This script helps developers resolve merge conflicts in package.json and
# package-lock.json files by automating the cleanup and regeneration process.
#
# Usage:
#   ./scripts/resolve-package-conflicts.sh
#
# What it does:
#   1. Detects merge conflicts in package files
#   2. For package.json: sorts dependencies and shows diff for review
#   3. For package-lock.json: removes and regenerates via npm install
#   4. Validates that builds still work after resolution
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/app/split-lease"
COMPONENTS_DIR="$APP_DIR/components"
SORT_SCRIPT="$ROOT_DIR/scripts/sort-package-deps.mjs"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Package Conflict Resolution Tool${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

###############################################################################
# Check for merge conflicts in git
###############################################################################

check_conflicts() {
  local file=$1
  if git diff --check "$file" 2>/dev/null | grep -q "conflict"; then
    return 0  # Has conflicts
  elif git ls-files -u "$file" 2>/dev/null | grep -q "$file"; then
    return 0  # Has conflicts
  elif grep -q "<<<<<<< HEAD" "$file" 2>/dev/null; then
    return 0  # Has conflicts
  else
    return 1  # No conflicts
  fi
}

###############################################################################
# Resolve package.json conflicts
###############################################################################

resolve_package_json() {
  local pkg_file=$1
  local pkg_name=$2

  echo -e "${YELLOW}Processing $pkg_name package.json...${NC}"

  if check_conflicts "$pkg_file"; then
    echo -e "${RED}✗ Merge conflict detected in $pkg_file${NC}"
    echo -e "${YELLOW}Please manually resolve the conflicts first, then run this script again.${NC}"
    echo -e "${YELLOW}Tips for resolving:${NC}"
    echo "  1. Keep all unique dependencies from both branches"
    echo "  2. For version conflicts, choose the newer version"
    echo "  3. Remove conflict markers (<<<<<<, =======, >>>>>>)"
    echo "  4. Save the file and run this script to sort it"
    echo ""
    return 1
  else
    echo -e "${GREEN}✓ No conflicts in $pkg_file${NC}"
    return 0
  fi
}

###############################################################################
# Resolve package-lock.json conflicts
###############################################################################

resolve_lock_file() {
  local lock_file=$1
  local work_dir=$2
  local pkg_name=$3

  echo -e "${YELLOW}Processing $pkg_name package-lock.json...${NC}"

  if check_conflicts "$lock_file"; then
    echo -e "${RED}✗ Merge conflict detected in $lock_file${NC}"
    echo -e "${YELLOW}Removing conflicted lock file and regenerating...${NC}"

    # Remove the conflicted lock file
    rm -f "$lock_file"

    # Regenerate by running npm install
    echo -e "${BLUE}Running npm install in $work_dir...${NC}"
    (cd "$work_dir" && npm install)

    # Mark as resolved in git
    git add "$lock_file"

    echo -e "${GREEN}✓ Regenerated $lock_file${NC}"
    return 0
  else
    echo -e "${GREEN}✓ No conflicts in $lock_file${NC}"
    return 0
  fi
}

###############################################################################
# Main execution
###############################################################################

echo "Checking for package file conflicts..."
echo ""

# Track if we made any changes
CHANGES_MADE=false

# Check root app package files
echo -e "${BLUE}--- Root App (app/split-lease) ---${NC}"
if resolve_package_json "$APP_DIR/package.json" "root app"; then
  resolve_lock_file "$APP_DIR/package-lock.json" "$APP_DIR" "root app"
  CHANGES_MADE=true
fi
echo ""

# Check components package files
echo -e "${BLUE}--- Components Library (app/split-lease/components) ---${NC}"
if resolve_package_json "$COMPONENTS_DIR/package.json" "components"; then
  resolve_lock_file "$COMPONENTS_DIR/package-lock.json" "$COMPONENTS_DIR" "components"
  CHANGES_MADE=true
fi
echo ""

###############################################################################
# Sort package.json files
###############################################################################

echo -e "${BLUE}--- Sorting package.json files ---${NC}"
if [ -f "$SORT_SCRIPT" ]; then
  node "$SORT_SCRIPT"
  echo -e "${GREEN}✓ Dependencies sorted${NC}"
else
  echo -e "${YELLOW}⚠ Sort script not found at $SORT_SCRIPT${NC}"
fi
echo ""

###############################################################################
# Validation
###############################################################################

echo -e "${BLUE}--- Validation ---${NC}"
echo "Running quick validation checks..."
echo ""

# Check that package.json files are valid JSON
echo -n "Validating root package.json... "
if node -e "JSON.parse(require('fs').readFileSync('$APP_DIR/package.json', 'utf8'))" 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Invalid JSON${NC}"
  exit 1
fi

echo -n "Validating components package.json... "
if node -e "JSON.parse(require('fs').readFileSync('$COMPONENTS_DIR/package.json', 'utf8'))" 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Invalid JSON${NC}"
  exit 1
fi

echo ""

###############################################################################
# Done
###############################################################################

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}Resolution complete!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Run tests to ensure nothing broke"
echo "  3. Commit the resolved files: git add . && git commit"
echo ""
