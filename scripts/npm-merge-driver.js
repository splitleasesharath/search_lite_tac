#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Custom Git merge driver for package-lock.json
 *
 * This script handles package-lock.json merge conflicts by:
 * 1. Taking the current branch version
 * 2. Running npm install to regenerate the lock file
 * 3. This ensures the lock file is always valid and up-to-date
 *
 * Usage (called by Git):
 *   node scripts/npm-merge-driver.js %O %A %B %P
 *
 * Arguments:
 *   %O - ancestor's version
 *   %A - current version (ours)
 *   %B - other branch's version (theirs)
 *   %P - path to file being merged
 */

const [,, ancestor, current, other, pathname] = process.argv;

if (!pathname) {
  console.error('Usage: npm-merge-driver.js <ancestor> <current> <other> <pathname>');
  process.exit(1);
}

console.log(`\nResolving package-lock.json conflict for: ${pathname}`);

try {
  // Determine which directory the package-lock.json belongs to
  const lockFileDir = dirname(pathname);
  const packageJsonPath = resolve(lockFileDir, 'package.json');

  console.log(`Working directory: ${lockFileDir}`);

  // Use the current branch's package.json and regenerate lock file
  console.log('Regenerating package-lock.json from package.json...');

  // Run npm install in the appropriate directory
  execSync('npm install --package-lock-only', {
    cwd: lockFileDir,
    stdio: 'inherit'
  });

  console.log('✓ package-lock.json regenerated successfully\n');
  process.exit(0);

} catch (error) {
  console.error('✗ Failed to regenerate package-lock.json:', error.message);
  console.error('\nManual resolution required.');
  process.exit(1);
}
