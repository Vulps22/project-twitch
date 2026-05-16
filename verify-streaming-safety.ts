#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';

export interface CheckResult {
    message: string;
    passed: boolean;
}

export function runChecks(): CheckResult[] {
    const results: CheckResult[] = [];

    const envFiles = ['.env', 'backend/.env'];
    for (const envFile of envFiles) {
        if (fs.existsSync(envFile)) {
            results.push({ message: `✅ ${envFile} exists (good - your config is there)`, passed: true });
        } else {
            results.push({ message: `⚠️  ${envFile} not found (you may need to create it)`, passed: true });
        }
    }

    if (fs.existsSync('.vscode/settings.json')) {
        const settings = JSON.parse(fs.readFileSync('.vscode/settings.json', 'utf8')) as Record<string, unknown>;
        const fileExcludes = settings['files.exclude'] as Record<string, unknown> | undefined;
        if (fileExcludes?.['**/.env']) {
            results.push({ message: '✅ VS Code file exclusions configured', passed: true });
        } else {
            results.push({ message: '❌ VS Code file exclusions NOT configured', passed: false });
        }
    } else {
        results.push({ message: '❌ VS Code settings.json missing', passed: false });
    }

    if (fs.existsSync('.gitignore')) {
        const gitignore = fs.readFileSync('.gitignore', 'utf8');
        if (gitignore.includes('.env')) {
            results.push({ message: '✅ .gitignore protects .env files', passed: true });
        } else {
            results.push({ message: '❌ .gitignore does NOT protect .env files', passed: false });
        }
    } else {
        results.push({ message: '❌ .gitignore missing', passed: false });
    }

    return results;
}

// Only execute when run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log('🚨 STREAMING SAFETY CHECK 🚨\n');

    const checks = runChecks();
    checks.forEach(check => console.log(check.message));

    const hasErrors = checks.some(check => !check.passed);
    console.log('\n' + '='.repeat(50));
    if (hasErrors) {
        console.log('❌ STREAMING NOT SAFE - Fix issues above first!');
        process.exit(1);
    } else {
        console.log('✅ STREAMING SAFE - Your credentials are protected!');
        console.log('🎯 Ready to stream! Your .env files are hidden.');
    }
}
