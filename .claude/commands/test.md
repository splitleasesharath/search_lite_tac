# Application Validation Test Suite

Execute comprehensive validation tests for the React Islands component library and test infrastructure, returning results in a standardized JSON format for automated processing.

## Purpose

Proactively identify and fix issues in the application before they impact users or developers. By running this comprehensive test suite, you can:
- Detect TypeScript type errors and compilation issues
- Identify broken builds or invalid UMD bundles
- Verify component tests pass and components render correctly
- Ensure the application is in a healthy state

## Variables

TEST_COMMAND_TIMEOUT: 5 minutes

## Instructions

- Execute each test in the sequence provided below
- Capture the result (passed/failed) and any error messages
- IMPORTANT: Return ONLY the JSON array with test results
  - IMPORTANT: Do not include any additional text, explanations, or markdown formatting
  - We'll immediately run JSON.parse() on the output, so make sure it's valid JSON
- If a test passes, omit the error field
- If a test fails, include the error message in the error field
- Execute all tests even if some fail
- Error Handling:
  - If a command returns non-zero exit code, mark as failed and immediately stop processing tests
  - Capture stderr output for error field
  - Timeout commands after `TEST_COMMAND_TIMEOUT`
  - IMPORTANT: If a test fails, stop processing tests and return the results thus far
- Test execution order is important - dependencies should be validated first
- All file paths are relative to the project root
- Always run `pwd` and `cd` before each test to ensure you're operating in the correct directory for the given test

## Test Execution Sequence

### Component Library Tests

1. **TypeScript Type Check**
   - Preparation Command: None
   - Command: `cd app/split-lease/components && npm run typecheck`
   - test_name: "typescript_check"
   - test_purpose: "Validates TypeScript type correctness for React components without generating output files, catching type errors, missing imports, and incorrect function signatures"

2. **Component Build**
   - Preparation Command: None
   - Command: `cd app/split-lease/components && npm run build`
   - test_name: "component_build"
   - test_purpose: "Validates the complete component build process, compiling React components to UMD bundles via Vite, ensuring all components export correctly and the bundle is generated successfully"

3. **UMD Bundle Validation**
   - Preparation Command: None
   - Command: `cd app/test-harness && npm run test:validate`
   - test_name: "umd_bundle_validation"
   - test_purpose: "Validates the UMD bundle structure, verifying the global namespace is exposed, all components are exported correctly, bundle size is reasonable, and React references are present"

4. **Component Contract Tests**
   - Preparation Command: None
   - Command: `cd app/test-harness && npx playwright test --grep "contract"`
   - test_name: "component_contract_tests"
   - test_purpose: "Validates component contracts using Playwright browser tests, ensuring components render without errors, props work correctly, callbacks fire, and configuration toggles function as expected"

5. **Component Diagnostic Tests**
   - Preparation Command: None
   - Command: `cd app/test-harness && npx playwright test --grep "diagnostics"`
   - test_name: "component_diagnostic_tests"
   - test_purpose: "Proactive problem detection including accessibility violations, console errors, keyboard navigation, performance issues, and memory leaks to catch potential issues before production"

## Report

- IMPORTANT: Return results exclusively as a JSON array based on the `Output Structure` section below.
- Sort the JSON array with failed tests (passed: false) at the top
- Include all tests in the output, both passed and failed
- The execution_command field should contain the exact command that can be run to reproduce the test
- This allows subsequent agents to quickly identify and resolve errors

### Output Structure

```json
[
  {
    "test_name": "string",
    "passed": boolean,
    "execution_command": "string",
    "test_purpose": "string",
    "error": "optional string"
  },
  ...
]
```

### Example Output

```json
[
  {
    "test_name": "component_build",
    "passed": false,
    "execution_command": "cd app/split-lease/components && npm run build",
    "test_purpose": "Validates the complete component build process, compiling React components to UMD bundles via Vite",
    "error": "TS2345: Argument of type 'string' is not assignable to parameter of type 'number'"
  },
  {
    "test_name": "component_contract_tests",
    "passed": true,
    "execution_command": "cd app/test-harness && npx playwright test --grep \"contract\"",
    "test_purpose": "Validates component contracts using Playwright browser tests, ensuring components render without errors"
  }
]
```