# No Fallback Mechanism Enforcement System

This directory contains slash commands that enforce the principle of "building for truth" by preventing fallback mechanisms and hardcoded data throughout the development lifecycle.

## Core Commands

### `/enforce_no_fallback`
**When to use:** Before writing any new code or creating implementation plans

**Purpose:** Reminds you of the no-fallback principles and validates your plan before implementation

**Use in:**
- `/bug` - Before creating bug fix plans
- `/feature` - Before creating feature implementation plans
- `/patch` - Before creating patch plans
- `/chore` - Before creating chore plans

**What it checks:**
- Your implementation plan doesn't include fallback mechanisms
- You're solving root causes, not adding workarounds
- Scale matches actual requirements
- Solution is direct and simple

### `/no_fallback_check`
**When to use:** During code review phase

**Purpose:** Scans the codebase for patterns that indicate fallback mechanisms or hardcoded data

**Use in:**
- `/review` - Automatically called to audit changes before approval

**What it detects:**
- `||` operators with default/fallback values
- `??` nullish coalescing with fallbacks
- Try-catch blocks returning defaults
- Hardcoded mock/sample data
- Feature flags used as workarounds
- Multiple API endpoints as "backups"

## Integration Pattern

### Planning Phase (Before Code)
```
/feature <args>
  └─> Calls /enforce_no_fallback
      └─> Reviews plan against principles
      └─> Confirms readiness or flags concerns
```

### Review Phase (After Code)
```
/review <args>
  └─> Calls /no_fallback_check
      └─> Scans code for violations
      └─> Reports findings with severity
      └─> Categorizes as fallback_mechanism or hardcoded_data
```

## Severity Levels

When violations are found, they're categorized as:

- **blocker** - Violates core principle, must be fixed before release
- **tech_debt** - Creates technical debt, should be addressed
- **skippable** - Non-critical but still a concern

## Examples of What Gets Flagged

### Fallback Mechanisms (BAD)
```javascript
// BAD: Hiding missing data with fallback
const listings = data || []

// BAD: Silently failing with default
fetch('/api/data').catch(() => [])

// BAD: Multiple fallback attempts
const result = tryAPI1() || tryAPI2() || defaultData
```

### Proper Error Handling (GOOD)
```javascript
// GOOD: Explicit error handling
if (!data) {
  throw new Error('Data is required')
}

// GOOD: Surface the error
const listings = await fetchListings() // throws on error
// Handle at UI layer with proper error state

// GOOD: Single source of truth
const result = await fetchFromAPI() // no fallbacks
```

## Workflow Integration

1. **Planning:** `/bug`, `/feature`, `/patch`, `/chore` all call `/enforce_no_fallback` first
2. **Implementation:** Developer implements following the approved plan
3. **Review:** `/review` calls `/no_fallback_check` to audit the changes
4. **Issue Tracking:** Any violations are reported with `issue_type: 'fallback_mechanism'` or `'hardcoded_data'`

## Philosophy

> "When you encounter challenges or limitations, resist the temptation to add fallback logic, compatibility layers, or workarounds. These create technical debt and obscure the real problem. Instead, solve the root issue or acknowledge the constraint honestly."

The system enforces this by:
- Preventing fallbacks before they're written (planning phase)
- Catching them if they slip through (review phase)
- Categorizing and tracking them for resolution
- Making them visible to all stakeholders
