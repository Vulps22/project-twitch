import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EventConfig } from '../backend/src/types.js'

vi.mock('../backend/src/utils/Logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

const SEED: Record<string, EventConfig> = {
    lurk: {
        event_name: 'lurk',
        event_type: 'channel_points_redemption',
        trigger_on: ['lurk'],
        reactions: [{ type: 'chat_reply', message: 'Thanks for lurking!' }],
    },
    follow: {
        event_name: 'follow',
        event_type: 'follow',
        reactions: [{ type: 'chat_reply', message: 'Thanks for the follow!' }],
    },
}

vi.mock('../backend/config/events.js', () => ({ EVENTS: SEED }))

let diskData: string | null = null

vi.mock('fs/promises', () => ({
    readFile: vi.fn(async () => {
        if (diskData === null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        return diskData
    }),
    writeFile: vi.fn(async (_path: string, content: string) => { diskData = content }),
    mkdir: vi.fn(async () => {}),
}))

async function freshStorage() {
    vi.resetModules()
    const { EventStorage } = await import('../backend/src/EventStorage.js')
    return new EventStorage()
}

describe('EventStorage', () => {
    beforeEach(() => {
        diskData = null
        vi.clearAllMocks()
    })

    it('seeds from EVENTS config when no file exists', async () => {
        const storage = await freshStorage()
        await storage.load()
        expect(storage.getAll()).toHaveLength(2)
        expect(storage.getAll().map(e => e.event_name)).toContain('lurk')
    })

    it('writes events.json to disk on first load', async () => {
        const { writeFile } = await import('fs/promises')
        const storage = await freshStorage()
        await storage.load()
        expect(writeFile).toHaveBeenCalled()
        expect(diskData).not.toBeNull()
    })

    it('loads from disk when file exists', async () => {
        diskData = JSON.stringify({
            custom: { event_name: 'custom', event_type: 'follow', reactions: [] },
        })
        const storage = await freshStorage()
        await storage.load()
        expect(storage.getAll()).toHaveLength(1)
        expect(storage.getAll()[0].event_name).toBe('custom')
    })

    it('delete removes the event and returns true', async () => {
        const storage = await freshStorage()
        await storage.load()
        const result = await storage.delete('lurk')
        expect(result).toBe(true)
        expect(storage.getAll().map(e => e.event_name)).not.toContain('lurk')
    })

    it('delete returns false for unknown event', async () => {
        const storage = await freshStorage()
        await storage.load()
        const result = await storage.delete('nonexistent')
        expect(result).toBe(false)
    })

    it('delete persists the change to disk', async () => {
        const { writeFile } = await import('fs/promises')
        const storage = await freshStorage()
        await storage.load()
        vi.clearAllMocks()
        await storage.delete('lurk')
        expect(writeFile).toHaveBeenCalled()
    })

    it('getAll throws if load() was not called', async () => {
        const storage = await freshStorage()
        expect(() => storage.getAll()).toThrow('load()')
    })

    describe('create', () => {
        it('adds a new event and returns true', async () => {
            const storage = await freshStorage()
            await storage.load()
            const newEvent = { event_name: 'hype', event_type: 'chat_command', trigger_on: ['hype'], reactions: [] }
            const result = await storage.create(newEvent)
            expect(result).toBe(true)
            expect(storage.getAll().map(e => e.event_name)).toContain('hype')
        })

        it('returns false when event name already exists', async () => {
            const storage = await freshStorage()
            await storage.load()
            const duplicate = { event_name: 'lurk', event_type: 'chat_command', reactions: [] }
            const result = await storage.create(duplicate)
            expect(result).toBe(false)
        })

        it('persists new event to disk', async () => {
            const { writeFile } = await import('fs/promises')
            const storage = await freshStorage()
            await storage.load()
            vi.clearAllMocks()
            await storage.create({ event_name: 'hype', event_type: 'chat_command', reactions: [] })
            expect(writeFile).toHaveBeenCalled()
        })
    })

    describe('update', () => {
        it('updates an existing event and returns true', async () => {
            const storage = await freshStorage()
            await storage.load()
            const updated = { event_name: 'lurk', event_type: 'follow', reactions: [] }
            const result = await storage.update('lurk', updated)
            expect(result).toBe(true)
            expect(storage.getAll().find(e => e.event_name === 'lurk')?.event_type).toBe('follow')
        })

        it('returns false for unknown event', async () => {
            const storage = await freshStorage()
            await storage.load()
            const result = await storage.update('nonexistent', { event_name: 'nonexistent', event_type: 'follow', reactions: [] })
            expect(result).toBe(false)
        })

        it('persists updated event to disk', async () => {
            const { writeFile } = await import('fs/promises')
            const storage = await freshStorage()
            await storage.load()
            vi.clearAllMocks()
            await storage.update('lurk', { event_name: 'lurk', event_type: 'follow', reactions: [] })
            expect(writeFile).toHaveBeenCalled()
        })
    })
})
