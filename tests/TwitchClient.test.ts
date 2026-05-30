import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Module mocks (must be declared before any imports that use them) ---

vi.mock('ws', () => {
    // Must be a proper class (constructor function) so `new WebSocket(...)` works
    class MockWebSocket {
        onopen: (() => void) | null = null
        onmessage: ((e: unknown) => void) | null = null
        onclose: ((e: unknown) => void) | null = null
        onerror: ((e: unknown) => void) | null = null
        send = vi.fn()
        close = vi.fn()
    }
    return { default: MockWebSocket }
})

vi.mock('node-fetch', () => ({
    default: vi.fn(),
}))

vi.mock('../backend/src/utils/Logger.js', () => ({
    default: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
    },
}))

// --- Imports (after mocks) ---

import fetch from 'node-fetch'
import { TwitchClient } from '../backend/src/twitch-client.js'
import type { IEventRouter, TwitchRawEvent } from '../backend/src/types.js'

const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>

// --- Helpers ---

/** Minimal fetch Response-like object */
function makeResponse(ok: boolean, json: unknown, statusText = 'OK') {
    return {
        ok,
        statusText,
        json: vi.fn().mockResolvedValue(json),
    }
}

/** Standard user response used during init() */
function userResponse() {
    return makeResponse(true, { data: [{ id: 'user-123', display_name: 'TestBot' }] })
}

/** Validation response with all required scopes */
function validationResponse() {
    return makeResponse(true, {
        scopes: [
            'user:read:chat',
            'user:write:chat',
            'channel:read:subscriptions',
            'moderator:read:followers',
            'moderator:read:chatters',
            'channel:read:redemptions',
        ],
    })
}

/**
 * Sets up mockFetch to handle the init() sequence:
 * getUserId → getChannelId (optional) → checkTokenScopes
 * Extra responses are appended for post-init calls.
 */
function setupInitMocks(extraResponses: unknown[] = []) {
    mockFetch
        .mockResolvedValueOnce(userResponse())    // getUserId
        .mockResolvedValueOnce(validationResponse()) // checkTokenScopes (no channelName)

    for (const r of extraResponses) {
        mockFetch.mockResolvedValueOnce(r)
    }
}

function makeEventRouter(): IEventRouter {
    return { route: vi.fn().mockResolvedValue(undefined) }
}

// --- Tests ---

describe('TwitchClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('constructor', () => {
        it('throws when accessToken is missing', () => {
            expect(() => new TwitchClient({ clientId: 'cid' })).toThrow(
                'Access token and client ID are required.'
            )
        })

        it('throws when clientId is missing', () => {
            expect(() => new TwitchClient({ accessToken: 'tok' })).toThrow(
                'Access token and client ID are required.'
            )
        })

        it('constructs successfully with both credentials', () => {
            setupInitMocks()
            expect(
                () => new TwitchClient({ accessToken: 'tok', clientId: 'cid' })
            ).not.toThrow()
        })
    })

    describe('sendChatMessage', () => {
        it('returns false when userId is not yet populated (credentials missing at send time)', async () => {
            // Arrange: init getUserId returns no data so userId stays null
            mockFetch
                .mockResolvedValueOnce(makeResponse(false, {}, 'Unauthorized')) // getUserId fails
                .mockResolvedValueOnce(validationResponse())                     // checkTokenScopes

            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid' })
            // Wait for async init to settle
            await new Promise(r => setTimeout(r, 0))

            const result = await client.sendChatMessage('hello')
            expect(result).toBe(false)
        })

        it('makes a POST to the Helix chat messages endpoint', async () => {
            setupInitMocks()
            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid' })
            await new Promise(r => setTimeout(r, 0))

            // At this point userId is set but channelId also = userId since no channelName
            // Arrange a successful send response
            mockFetch.mockResolvedValueOnce(makeResponse(true, {}))

            const result = await client.sendChatMessage('hello world')

            expect(result).toBe(true)
            const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
            const [url, options] = lastCall as [string, { method: string; body: string }]
            expect(url).toBe('https://api.twitch.tv/helix/chat/messages')
            expect(options.method).toBe('POST')
            const body = JSON.parse(options.body) as { message: string }
            expect(body.message).toBe('hello world')
        })

        it('returns false when the POST response is not ok', async () => {
            setupInitMocks()
            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid' })
            await new Promise(r => setTimeout(r, 0))

            mockFetch.mockResolvedValueOnce(makeResponse(false, { message: 'Bad Request' }))

            const result = await client.sendChatMessage('oops')
            expect(result).toBe(false)
        })
    })

    describe('handleNotification', () => {
        it('calls eventRouter.route with correct TwitchRawEvent shape', async () => {
            setupInitMocks()
            const eventRouter = makeEventRouter()
            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid', eventRouter })
            await new Promise(r => setTimeout(r, 0))

            const notification = {
                subscriptionType: 'channel.chat.message',
                event: { chatter_user_id: 'user-999', message: { text: '!lurk' } },
            }

            client.handleNotification(notification)

            expect(eventRouter.route).toHaveBeenCalledOnce()
            const routed = (eventRouter.route as ReturnType<typeof vi.fn>).mock.calls[0][0] as TwitchRawEvent
            expect(routed.subscriptionType).toBe('channel.chat.message')
            expect(routed.event).toEqual(notification.event)
        })

        it("skips the bot's own chat messages", async () => {
            setupInitMocks()
            const eventRouter = makeEventRouter()
            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid', eventRouter })
            await new Promise(r => setTimeout(r, 0))

            // The bot's own userId was set to 'user-123' by the mocked getUserId response
            const notification = {
                subscriptionType: 'channel.chat.message',
                event: { chatter_user_id: 'user-123' }, // same as bot userId
            }

            client.handleNotification(notification)

            expect(eventRouter.route).not.toHaveBeenCalled()
        })

        it('does nothing when eventRouter is not set', async () => {
            setupInitMocks()
            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid' })
            await new Promise(r => setTimeout(r, 0))

            const notification = {
                subscriptionType: 'channel.follow',
                event: { user_id: 'follower-1' },
            }

            // Should not throw
            expect(() => client.handleNotification(notification)).not.toThrow()
        })

        it('routes non-chat events regardless of user id', async () => {
            setupInitMocks()
            const eventRouter = makeEventRouter()
            const client = new TwitchClient({ accessToken: 'tok', clientId: 'cid', eventRouter })
            await new Promise(r => setTimeout(r, 0))

            const notification = {
                subscriptionType: 'channel.follow',
                event: { user_id: 'user-123' }, // same id but different event type — should NOT be filtered
            }

            client.handleNotification(notification)

            expect(eventRouter.route).toHaveBeenCalledOnce()
        })
    })
})
