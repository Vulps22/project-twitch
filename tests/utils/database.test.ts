import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPragma = vi.fn()
const mockClose = vi.fn()
const mockDbInstance = { pragma: mockPragma, close: mockClose }

vi.mock('better-sqlite3', () => ({
    // Must be a regular function (not arrow) so it can be used with `new`
    default: vi.fn(function () { return mockDbInstance }),
}))

vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
}))

vi.mock('../../backend/src/utils/Logger.js', () => ({
    default: { info: vi.fn(), error: vi.fn() },
}))

describe('database module', () => {
    beforeEach(() => {
        vi.resetModules()
        mockPragma.mockClear()
        mockClose.mockClear()
    })

    it('getDatabase returns null after closeDatabase is called', async () => {
        const { closeDatabase, getDatabase } = await import('../../backend/src/utils/database.js')
        // Module auto-inits on import; close to reset state
        closeDatabase()
        expect(getDatabase()).toBeNull()
    })

    it('getDatabase returns an instance after initDatabase', async () => {
        const { closeDatabase, initDatabase, getDatabase } = await import('../../backend/src/utils/database.js')
        closeDatabase()
        await initDatabase()
        expect(getDatabase()).not.toBeNull()
    })

    it('closeDatabase sets db back to null', async () => {
        const { initDatabase, closeDatabase, getDatabase } = await import('../../backend/src/utils/database.js')
        await initDatabase()
        closeDatabase()
        expect(getDatabase()).toBeNull()
    })

    it('initDatabase enables foreign keys via pragma', async () => {
        const { closeDatabase, initDatabase } = await import('../../backend/src/utils/database.js')
        closeDatabase()
        mockPragma.mockClear()
        await initDatabase()
        expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON')
    })
})
