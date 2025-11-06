#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Pre-commit hook to ensure package.json dependencies are sorted
 * This prevents unnecessary merge conflicts
 */

function isPackageJsonSorted(packagePath) {
  try {
    const content = readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);

    const depSections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
      'scripts'
    ];

    for (const section of depSections) {
      if (pkg[section]) {
        const keys = Object.keys(pkg[section]);
        const sorted = [...keys].sort();

        for (let i = 0; i < keys.length; i++) {
          if (keys[i] !== sorted[i]) {
            return false;
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`Error checking ${packagePath}:`, error.message);
    return false;
  }
}

// Get staged package.json files
let stagedFiles;
try {
  stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf8'
  }).trim().split('\n').filter(Boolean);
} catch (error) {
  console.error('Error getting staged files:', error.message);
  process.exit(1);
}

const packageFiles = stagedFiles.filter(file => file.endsWith('package.json'));

if (packageFiles.length === 0) {
  // No package.json files changed, exit successfully
  process.exit(0);
}

console.log('\nChecking package.json files for sorted dependencies...\n');

let needsSorting = false;

for (const file of packageFiles) {
  const fullPath = resolve(process.cwd(), file);

  if (!isPackageJsonSorted(fullPath)) {
    console.log(`✗ ${file} has unsorted dependencies`);
    needsSorting = true;
  } else {
    console.log(`✓ ${file} is properly sorted`);
  }
}

if (needsSorting) {
  console.log('\n❌ Some package.json files have unsorted dependencies.');
  console.log('Run: npm run sort-deps\n');
  console.log('Then stage the sorted files and commit again.\n');
  process.exit(1);
}

console.log('\n✓ All package.json files are properly sorted\n');
process.exit(0);
