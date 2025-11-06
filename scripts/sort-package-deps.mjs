#!/usr/bin/env node

/**
 * Sort dependencies in package.json files alphabetically
 * This helps minimize merge conflicts by ensuring consistent ordering
 *
 * Usage:
 *   node scripts/sort-package-deps.js [--check]
 *
 * Options:
 *   --check    Only verify that files are sorted, don't modify them
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHECK_MODE = process.argv.includes('--check');

/**
 * Sort object keys alphabetically
 */
function sortObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sorted = {};
  Object.keys(obj)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .forEach(key => {
      sorted[key] = obj[key];
    });
  return sorted;
}

/**
 * Sort package.json dependencies and scripts
 */
function sortPackageJson(packagePath) {
  const content = readFileSync(packagePath, 'utf8');
  const pkg = JSON.parse(content);

  // Fields to sort alphabetically
  const fieldsToSort = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
    'scripts'
  ];

  // Sort each field if it exists
  let modified = false;
  fieldsToSort.forEach(field => {
    if (pkg[field]) {
      const sorted = sortObject(pkg[field]);
      const originalStr = JSON.stringify(pkg[field]);
      const sortedStr = JSON.stringify(sorted);

      if (originalStr !== sortedStr) {
        modified = true;
        pkg[field] = sorted;
      }
    }
  });

  // Generate sorted JSON with 2-space indentation
  const sortedContent = JSON.stringify(pkg, null, 2) + '\n';

  if (CHECK_MODE) {
    if (modified) {
      console.error(`❌ ${packagePath} is not sorted`);
      return false;
    } else {
      console.log(`✓ ${packagePath} is sorted`);
      return true;
    }
  } else {
    if (modified) {
      writeFileSync(packagePath, sortedContent, 'utf8');
      console.log(`✓ Sorted ${packagePath}`);
    } else {
      console.log(`✓ ${packagePath} was already sorted`);
    }
    return true;
  }
}

/**
 * Main execution
 */
function main() {
  const rootDir = resolve(__dirname, '..');
  const packageFiles = [
    resolve(rootDir, 'app/split-lease/package.json'),
    resolve(rootDir, 'app/split-lease/components/package.json')
  ];

  console.log(CHECK_MODE ? 'Checking package.json files...' : 'Sorting package.json files...');
  console.log('');

  let allSorted = true;

  for (const packagePath of packageFiles) {
    try {
      const result = sortPackageJson(packagePath);
      if (!result) {
        allSorted = false;
      }
    } catch (error) {
      console.error(`Error processing ${packagePath}:`, error.message);
      allSorted = false;
    }
  }

  console.log('');

  if (CHECK_MODE && !allSorted) {
    console.error('Some package.json files are not sorted. Run without --check to fix.');
    process.exit(1);
  } else if (CHECK_MODE) {
    console.log('All package.json files are sorted correctly.');
  } else {
    console.log('Done! All package.json files have been sorted.');
  }
}

main();
