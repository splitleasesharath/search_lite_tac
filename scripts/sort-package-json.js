#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Sorts package.json dependencies alphabetically to minimize merge conflicts
 * Usage: node scripts/sort-package-json.js [path-to-package.json]
 */

function sortObjectKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = obj[key];
  });
  return sorted;
}

function sortPackageJson(packagePath) {
  try {
    const content = readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);

    // Track if anything changed
    let changed = false;
    const original = JSON.stringify(pkg, null, 2);

    // Sort dependency sections
    const depSections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ];

    depSections.forEach(section => {
      if (pkg[section]) {
        const sorted = sortObjectKeys(pkg[section]);
        if (JSON.stringify(sorted) !== JSON.stringify(pkg[section])) {
          pkg[section] = sorted;
          changed = true;
        }
      }
    });

    // Sort scripts section
    if (pkg.scripts) {
      const sorted = sortObjectKeys(pkg.scripts);
      if (JSON.stringify(sorted) !== JSON.stringify(pkg.scripts)) {
        pkg.scripts = sorted;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`✓ Sorted dependencies in ${packagePath}`);
      return true;
    } else {
      console.log(`✓ ${packagePath} already sorted`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error processing ${packagePath}:`, error.message);
    process.exit(1);
  }
}

// Main execution
const packagePaths = process.argv.slice(2);

if (packagePaths.length === 0) {
  // Default: sort both package.json files
  // Determine if we're in the repo root or app/split-lease directory
  const cwd = process.cwd();
  let rootDir;

  if (cwd.endsWith('split-lease')) {
    // We're in app/split-lease, go up to find repo root
    rootDir = resolve(cwd, '../..');
  } else if (cwd.includes('split-lease')) {
    // Find the TAC or repo root
    const parts = cwd.split(/[\\/]/);
    const tacIndex = parts.findIndex(p => p === 'TAC' || p === 'SL1');
    if (tacIndex !== -1) {
      rootDir = parts.slice(0, tacIndex + 1).join('/');
    } else {
      rootDir = cwd;
    }
  } else {
    rootDir = cwd;
  }

  const mainPackage = resolve(rootDir, 'app/split-lease/package.json');
  const componentsPackage = resolve(rootDir, 'app/split-lease/components/package.json');

  console.log('Sorting package.json files...\n');
  const changed1 = sortPackageJson(mainPackage);
  const changed2 = sortPackageJson(componentsPackage);

  if (changed1 || changed2) {
    console.log('\n✓ Package files sorted successfully');
  } else {
    console.log('\n✓ All package files already sorted');
  }
} else {
  // Sort specified files
  packagePaths.forEach(sortPackageJson);
}
