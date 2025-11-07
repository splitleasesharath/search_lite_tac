---
description: Enforce the no-fallback principle when writing new code or making changes
---

# No Fallback Enforcement Guard

This command runs BEFORE you implement any code changes to remind you of the no-fallback principle.

# Core Principles

## 1. No Fallback Mechanisms When Things Get Tough
When you encounter challenges or limitations, DO NOT:
- Add `|| []` or `|| {}` or `|| 'default'` patterns
- Use `.catch(() => defaultValue)` to hide errors
- Create try-catch blocks that return mock data on failure
- Add feature flags to work around problems
- Create compatibility layers or shims
- Use multiple API endpoints where one is a "backup"

INSTEAD:
- Solve the root issue
- Acknowledge the constraint honestly
- Throw proper errors that surface the problem
- Return null/undefined and handle it explicitly at the UI layer
- Ask the user for clarification if needed

## 2. Match Solution to Scale
- Don't build for hypothetical future needs
- Assess actual requirements before architecting
- Choose simple, direct solutions
- Avoid over-engineering

## 3. Embrace Constraints
- Work within natural boundaries of tools
- Difficulty implementing = signal you're fighting the design
- Friction is feedback

## 4. Be Direct
- Simple solutions over clever abstractions
- Code should do exactly what it says, nothing more
- No hardcoded data unless explicitly requested

# Pre-Implementation Checklist

Before writing code, confirm:

- [ ] Solution addresses root cause, not symptoms
- [ ] No default/fallback values for missing data
- [ ] Errors are thrown and handled explicitly
- [ ] No hardcoded sample/mock data
- [ ] Scale matches actual requirements
- [ ] Solution is direct and simple

# When to Ask User

If you find yourself wanting to add:
- A fallback mechanism because data might be missing
- Hardcoded data because the real source isn't ready
- Try-catch with default return because API might fail
- A compatibility layer because something doesn't work

STOP and ask the user how they want to handle it.

# Output

After reviewing the task against these principles, state:

```
✓ No fallback principle enforcement check complete
✓ Implementation plan adheres to building for truth
✓ Ready to proceed with authentic solution
```

Or if concerns exist:

```
⚠ Potential fallback mechanism detected in plan
⚠ Recommendation: [specific alternative approach]
⚠ Awaiting user confirmation before proceeding
```
