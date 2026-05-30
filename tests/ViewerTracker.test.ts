import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ViewerTracker } from '../backend/src/ViewerTracker.js'
import type { IDashboardBroadcaster, DashboardChatEvent } from '../backend/src/types.js'

vi.mock('../backend/src/utils/Logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

function makeBroadcaster(): IDashboardBroadcaster & { events: DashboardChatEvent[] } {
    const events: DashboardChatEvent[] = []
    return {
        events,
        broadcast: vi.fn((e: DashboardChatEvent) => events.push(e)),
        getClientCount: vi.fn(() => 0),
    }
}

function makeTwitchClient(chatters: { userId: string; username: string }[] = []) {
    return { getChatters: vi.fn().mockResolvedValue(chatters) }
}

describe('ViewerTracker', () => {
    let tracker: ViewerTracker
    let broadcaster: ReturnType<typeof makeBroadcaster>

    beforeEach(() => {
        tracker = new ViewerTracker()
        broadcaster = makeBroadcaster()
        tracker.setDashboardBroadcaster(broadcaster)
        vi.useFakeTimers()
    })

    afterEach(() => {
        tracker.stopPolling()
        vi.useRealTimers()
    })

    describe('recordEvent – chat message', () => {
        it('adds a new viewer on first message', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            const viewers = tracker.getViewers()
            expect(viewers).toHaveLength(1)
            expect(viewers[0].username).toBe('Alice')
            expect(viewers[0].messageCount).toBe(1)
        })

        it('increments messageCount for subsequent messages', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            expect(tracker.getViewers()[0].messageCount).toBe(2)
        })

        it('tracks multiple distinct viewers', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u2', chatter_user_name: 'Bob' })
            expect(tracker.getViewers()).toHaveLength(2)
        })

        it('broadcasts a chat event to the dashboard', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            expect(broadcaster.broadcast).toHaveBeenCalledWith({ type: 'chat', userId: 'u1', username: 'Alice' })
        })

        it('does nothing when chatter_user_id is missing', () => {
            tracker.recordEvent('channel.chat.message', {})
            expect(tracker.getViewers()).toHaveLength(0)
            expect(broadcaster.broadcast).not.toHaveBeenCalled()
        })
    })

    describe('recordEvent – stream online', () => {
        it('clears all viewers on channel.stream.online', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            tracker.recordEvent('channel.stream.online', {})
            expect(tracker.getViewers()).toHaveLength(0)
        })
    })

    describe('getViewers', () => {
        it('sorts viewers by watch time descending', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            vi.advanceTimersByTime(10_000)
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u2', chatter_user_name: 'Bob' })

            const viewers = tracker.getViewers()
            expect(viewers[0].username).toBe('Alice')
            expect(viewers[1].username).toBe('Bob')
        })

        it('returns watchTime in seconds since firstSeen', () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            vi.advanceTimersByTime(5_000)
            expect(tracker.getViewers()[0].watchTime).toBe(5)
        })
    })

    describe('startPolling', () => {
        it('syncs viewers immediately on start', async () => {
            const client = makeTwitchClient([{ userId: 'u1', username: 'Alice' }])
            tracker.setTwitchClient(client)
            await tracker.startPolling()
            expect(client.getChatters).toHaveBeenCalledOnce()
            expect(tracker.getViewers()).toHaveLength(1)
        })

        it('adds viewers from getChatters with messageCount 0', async () => {
            const client = makeTwitchClient([{ userId: 'u1', username: 'Alice' }])
            tracker.setTwitchClient(client)
            await tracker.startPolling()
            expect(tracker.getViewers()[0].messageCount).toBe(0)
        })

        it('removes viewers who are no longer in chatters list', async () => {
            tracker.recordEvent('channel.chat.message', { chatter_user_id: 'u1', chatter_user_name: 'Alice' })
            const client = makeTwitchClient([])
            tracker.setTwitchClient(client)
            await tracker.startPolling()
            expect(tracker.getViewers()).toHaveLength(0)
        })

        it('polls again after 60 seconds', async () => {
            const client = makeTwitchClient([])
            tracker.setTwitchClient(client)
            await tracker.startPolling()
            vi.advanceTimersByTime(60_000)
            await Promise.resolve()
            await Promise.resolve()
            expect(client.getChatters).toHaveBeenCalledTimes(2)
        })

        it('does nothing when twitchClient is not set', async () => {
            await tracker.startPolling()
            expect(tracker.getViewers()).toHaveLength(0)
        })
    })
})
