import { describe, it, expect, beforeEach, vi } from 'vitest'
import sessionStats from '../backend/src/SessionStats.js'
import eventLog from '../backend/src/EventLog.js'

vi.mock('../backend/src/utils/Logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

describe('SessionStats', () => {
    beforeEach(() => {
        sessionStats.reset()
    })

    describe('recordEvent', () => {
        it('increments follows on channel.follow', () => {
            sessionStats.recordEvent('channel.follow', {})
            expect(sessionStats.snapshot().follows).toBe(1)
        })

        it('increments subs on channel.subscribe', () => {
            sessionStats.recordEvent('channel.subscribe', {})
            expect(sessionStats.snapshot().subs).toBe(1)
        })

        it('adds bits amount on channel.cheer', () => {
            sessionStats.recordEvent('channel.cheer', { bits: 500 })
            sessionStats.recordEvent('channel.cheer', { bits: 100 })
            expect(sessionStats.snapshot().bits).toBe(600)
        })

        it('defaults bits to 0 when missing', () => {
            sessionStats.recordEvent('channel.cheer', {})
            expect(sessionStats.snapshot().bits).toBe(0)
        })

        it('increments raids on channel.raid', () => {
            sessionStats.recordEvent('channel.raid', {})
            expect(sessionStats.snapshot().raids).toBe(1)
        })

        it('increments chatMessages on channel.chat.message', () => {
            sessionStats.recordEvent('channel.chat.message', {})
            sessionStats.recordEvent('channel.chat.message', {})
            expect(sessionStats.snapshot().chatMessages).toBe(2)
        })

        it('does NOT increment eventsFired — that is done via recordEventFired()', () => {
            sessionStats.recordEvent('channel.follow', {})
            sessionStats.recordEvent('channel.subscribe', {})
            sessionStats.recordEvent('channel.cheer', { bits: 100 })
            expect(sessionStats.snapshot().eventsFired).toBe(0)
        })

        it('does NOT increment eventsFired for channel.stream.online', () => {
            sessionStats.recordEvent('channel.stream.online', {})
            expect(sessionStats.snapshot().eventsFired).toBe(0)
        })

        it('resets all counters on channel.stream.online', () => {
            sessionStats.recordEvent('channel.follow', {})
            sessionStats.recordEvent('channel.subscribe', {})
            sessionStats.recordEvent('channel.stream.online', {})
            const snap = sessionStats.snapshot()
            expect(snap.follows).toBe(0)
            expect(snap.subs).toBe(0)
            expect(snap.eventsFired).toBe(0)
        })

        it('also clears the event log on channel.stream.online', () => {
            eventLog.append({
                eventName: 'test', eventType: 'follow', subscriptionType: 'channel.follow',
                username: 'alice', detail: 'Followed', data: {},
            })
            sessionStats.recordEvent('channel.stream.online', {})
            expect(eventLog.getAll()).toHaveLength(0)
        })

        it('ignores unknown subscription types without throwing', () => {
            expect(() => sessionStats.recordEvent('channel.unknown', {})).not.toThrow()
        })
    })

    describe('recordEventFired', () => {
        it('increments eventsFired', () => {
            sessionStats.recordEventFired()
            sessionStats.recordEventFired()
            expect(sessionStats.snapshot().eventsFired).toBe(2)
        })

        it('is reset by channel.stream.online', () => {
            sessionStats.recordEventFired()
            sessionStats.recordEvent('channel.stream.online', {})
            expect(sessionStats.snapshot().eventsFired).toBe(0)
        })
    })

    describe('snapshot', () => {
        it('returns a copy of current counters', () => {
            sessionStats.recordEvent('channel.follow', {})
            sessionStats.recordEventFired()
            const snap = sessionStats.snapshot()
            expect(snap).toEqual({ follows: 1, subs: 0, bits: 0, chatMessages: 0, eventsFired: 1, raids: 0 })
        })
    })
})
