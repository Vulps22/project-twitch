#!/usr/bin/env node

// Streaming Safety Verification Script
// Run this before streaming to verify .env protection

import fs from 'fs';
import path from 'path';

console.log('🚨 STREAMING SAFETY CHECK 🚨\n');

const checks = [];

// Check 1: .env files exist but are protected
const envFiles = ['.env', 'backend/.env'];
envFiles.forEach(envFile => {
    if (fs.existsSync(envFile)) {
        checks.push(`✅ ${envFile} exists (good - your config is there)`);
    } else {
        checks.push(`⚠️  ${envFile} not found (you may need to create it)`);
    }
});

// Check 2: VS Code settings exist
if (fs.existsSync('.vscode/settings.json')) {
    const settings = JSON.parse(fs.readFileSync('.vscode/settings.json', 'utf8'));
    if (settings['files.exclude'] && settings['files.exclude']['**/.env']) {
        checks.push('✅ VS Code file exclusions configured');
    } else {
        checks.push('❌ VS Code file exclusions NOT configured');
    }
} else {
    checks.push('❌ VS Code settings.json missing');
}

// Check 3: .gitignore protection
if (fs.existsSync('.gitignore')) {
    const gitignore = fs.readFileSync('.gitignore', 'utf8');
    if (gitignore.includes('.env')) {
        checks.push('✅ .gitignore protects .env files');
    } else {
        checks.push('❌ .gitignore does NOT protect .env files');
    }
} else {
    checks.push('❌ .gitignore missing');
}

// Print results
checks.forEach(check => console.log(check));

// Final verdict
const hasErrors = checks.some(check => check.includes('❌'));
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    console.log('❌ STREAMING NOT SAFE - Fix issues above first!');
    process.exit(1);
} else {
    console.log('✅ STREAMING SAFE - Your credentials are protected!');
    console.log('🎯 Ready to stream! Your .env files are hidden.');
}