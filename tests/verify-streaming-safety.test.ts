import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
    }
}))

describe('runChecks', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('reports .env files as present when they exist', async () => {
        const fs = (await import('fs')).default as { existsSync: ReturnType<typeof vi.fn>, readFileSync: ReturnType<typeof vi.fn> }
        fs.existsSync.mockImplementation((p: string) => ['.env', '.vscode/settings.json', '.gitignore'].includes(p))
        fs.readFileSync.mockImplementation((p: string) => {
            if (p === '.vscode/settings.json') return JSON.stringify({ 'files.exclude': { '**/.env': true } })
            if (p === '.gitignore') return '.env\n'
            return ''
        })
        const { runChecks } = await import('../verify-streaming-safety.js')
        const results = runChecks()
        const envCheck = results.find(r => r.message.includes('.env exists'))
        expect(envCheck).toBeDefined()
        expect(envCheck!.passed).toBe(true)
    })

    it('fails when VS Code file exclusions are not configured', async () => {
        const fs = (await import('fs')).default as { existsSync: ReturnType<typeof vi.fn>, readFileSync: ReturnType<typeof vi.fn> }
        fs.existsSync.mockImplementation((p: string) => ['.vscode/settings.json', '.gitignore'].includes(p))
        fs.readFileSync.mockImplementation((p: string) => {
            if (p === '.vscode/settings.json') return JSON.stringify({ 'files.exclude': {} })
            if (p === '.gitignore') return '.env\n'
            return ''
        })
        const { runChecks } = await import('../verify-streaming-safety.js')
        const results = runChecks()
        const vscodeCheck = results.find(r => r.message.includes('VS Code file exclusions'))
        expect(vscodeCheck?.passed).toBe(false)
    })

    it('fails when .gitignore does not protect .env files', async () => {
        const fs = (await import('fs')).default as { existsSync: ReturnType<typeof vi.fn>, readFileSync: ReturnType<typeof vi.fn> }
        fs.existsSync.mockImplementation((p: string) => ['.vscode/settings.json', '.gitignore'].includes(p))
        fs.readFileSync.mockImplementation((p: string) => {
            if (p === '.vscode/settings.json') return JSON.stringify({ 'files.exclude': { '**/.env': true } })
            if (p === '.gitignore') return '# no env protection here\n'
            return ''
        })
        const { runChecks } = await import('../verify-streaming-safety.js')
        const results = runChecks()
        const gitignoreCheck = results.find(r => r.message.includes('.gitignore'))
        expect(gitignoreCheck?.passed).toBe(false)
    })

    it('passes all checks with a correctly configured project', async () => {
        const fs = (await import('fs')).default as { existsSync: ReturnType<typeof vi.fn>, readFileSync: ReturnType<typeof vi.fn> }
        fs.existsSync.mockReturnValue(true)
        fs.readFileSync.mockImplementation((p: string) => {
            if (p === '.vscode/settings.json') return JSON.stringify({ 'files.exclude': { '**/.env': true } })
            if (p === '.gitignore') return '.env\n'
            return ''
        })
        const { runChecks } = await import('../verify-streaming-safety.js')
        const results = runChecks()
        const failures = results.filter(r => !r.passed)
        expect(failures).toHaveLength(0)
    })
})
