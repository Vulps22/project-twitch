import { describe, it, expect, beforeEach, vi } from 'vitest'
import eventLog from '../backend/src/EventLog.js'

vi.mock('../backend/src/utils/Logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

function makeEntry(overrides: Partial<Parameters<typeof eventLog.append>[0]> = {}) {
    return {
        eventName:        'test_event',
        eventType:        'follow',
        subscriptionType: 'channel.follow',
        username:         'testuser',
        detail:           'Followed the channel',
        data:             { user_name: 'testuser' },
        ...overrides,
    }
}

describe('EventLog', () => {
    beforeEach(() => {
        eventLog.reset()
    })

    describe('append', () => {
        it('adds an entry with a generated id and timestamp', () => {
            eventLog.append(makeEntry())
            const entries = eventLog.getAll()
            expect(entries).toHaveLength(1)
            expect(entries[0].id).toBeTruthy()
            expect(entries[0].timestamp).toBeInstanceOf(Date)
        })

        it('stores all provided fields', () => {
            const data = { user_id: '123', user_name: 'alice' }
            eventLog.append(makeEntry({ username: 'alice', detail: 'Followed the channel', data }))
            const entry = eventLog.getAll()[0]
            expect(entry.username).toBe('alice')
            expect(entry.detail).toBe('Followed the channel')
            expect(entry.data).toEqual(data)
        })

        it('prepends — newest entry is first', () => {
            eventLog.append(makeEntry({ username: 'first' }))
            eventLog.append(makeEntry({ username: 'second' }))
            const entries = eventLog.getAll()
            expect(entries[0].username).toBe('second')
            expect(entries[1].username).toBe('first')
        })

        it('caps at 500 entries', () => {
            for (let i = 0; i < 510; i++) {
                eventLog.append(makeEntry({ username: `user${i}` }))
            }
            expect(eventLog.getAll()).toHaveLength(500)
        })

        it('discards oldest entries when cap is exceeded', () => {
            for (let i = 0; i < 501; i++) {
                eventLog.append(makeEntry({ username: `user${i}` }))
            }
            const entries = eventLog.getAll()
            // newest is user500, oldest kept is user1 (user0 dropped)
            expect(entries[0].username).toBe('user500')
            expect(entries[499].username).toBe('user1')
        })
    })

    describe('getById', () => {
        it('returns the matching entry', () => {
            eventLog.append(makeEntry({ username: 'alice' }))
            const id = eventLog.getAll()[0].id
            expect(eventLog.getById(id)?.username).toBe('alice')
        })

        it('returns undefined for an unknown id', () => {
            expect(eventLog.getById('does-not-exist')).toBeUndefined()
        })
    })

    describe('reset', () => {
        it('clears all entries', () => {
            eventLog.append(makeEntry())
            eventLog.append(makeEntry())
            eventLog.reset()
            expect(eventLog.getAll()).toHaveLength(0)
        })
    })
})
