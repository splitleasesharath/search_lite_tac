# Install Worktree

This command sets up an isolated worktree environment for React Islands development and testing.

## Parameters
- Worktree path: {0}
- Static server port: {1} (default: 8080)

## Read
- .env.sample (from parent repo, if exists)
- .mcp.json (from parent repo)
- playwright-mcp-config.json (from parent repo)

## Steps

1. **Navigate to worktree directory**
   ```bash
   cd {0}
   ```

2. **Create port configuration file**
   Create `.ports.env` with:
   ```
   STATIC_SERVER_PORT={1}
   ```

3. **Copy .env file if needed**
   - Copy `.env` from parent repo if it exists (for ADW cloudflare config, etc.)
   - Append `.ports.env` contents to `.env`

4. **Copy and configure MCP files**
   - Copy `.mcp.json` from parent repo if it exists
   - Copy `playwright-mcp-config.json` from parent repo if it exists
   - These files are needed for Model Context Protocol and Playwright automation

   After copying, update paths to use absolute paths:
   - Get the absolute worktree path: `WORKTREE_PATH=$(pwd)`
   - Update `.mcp.json`:
     - Find the line containing `"./playwright-mcp-config.json"`
     - Replace it with `"${WORKTREE_PATH}/playwright-mcp-config.json"`
     - Use a JSON-aware tool or careful string replacement to maintain valid JSON
   - Update `playwright-mcp-config.json`:
     - Find the line containing `"dir": "./videos"`
     - Replace it with `"dir": "${WORKTREE_PATH}/videos"`
     - Create the videos directory: `mkdir -p ${WORKTREE_PATH}/videos`
   - This ensures MCP configuration works correctly regardless of execution context

5. **Install component library dependencies**
   ```bash
   cd app/split-lease/components && npm install
   ```

6. **Install test harness dependencies**
   ```bash
   cd ../../test-harness && npm install
   ```

7. **Build React components**
   ```bash
   cd ../split-lease/components && npm run build
   ```

## Error Handling
- If parent .env files don't exist, that's okay - create minimal .ports.env only
- Ensure all paths are absolute to avoid confusion

## Report
- List all files created/modified (including MCP configuration files)
- Show port assignment for static server
- Confirm dependencies installed for components and test harness
- Confirm React components built to UMD bundles
- Note any missing parent .env files (optional for this project)
- Note any missing MCP configuration files
- Show the updated absolute paths in:
  - `.mcp.json` (should show full path to playwright-mcp-config.json)
  - `playwright-mcp-config.json` (should show full path to videos directory)
- Confirm videos directory was created