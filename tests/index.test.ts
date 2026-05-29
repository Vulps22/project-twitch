import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../backend/src/server.js', () => ({
    wss: { clients: new Set(), on: vi.fn() },
    app: { get: vi.fn(), post: vi.fn(), use: vi.fn() },
    server: {}
}))

vi.mock('better-sqlite3', () => ({
    default: vi.fn(function () { return { pragma: vi.fn(), close: vi.fn() } })
}))

vi.mock('fs', () => ({
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
}))

vi.mock('../backend/src/utils/Logger.js', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

vi.mock('node-fetch', () => ({ default: vi.fn() }))

vi.mock('ws', () => ({
    default: vi.fn(),
    WebSocket: { OPEN: 1 },
    WebSocketServer: vi.fn(function () {
        return { clients: new Set(), on: vi.fn() }
    })
}))

describe('index bootstrap (no credentials)', () => {
    beforeEach(() => {
        vi.resetModules()
        delete process.env.TWITCH_ACCESS_TOKEN
        delete process.env.TWITCH_CLIENT_ID
        delete process.env.TWITCH_CHANNEL_NAME
    })

    it('does not throw when Twitch credentials are absent', async () => {
        await expect(import('../backend/index.js')).resolves.not.toThrow()
    })

    it('exports twitchClient as null without credentials', async () => {
        const mod = await import('../backend/index.js')
        expect(mod.twitchClient).toBeNull()
    })

    it('exports eventRouter as null without credentials', async () => {
        const mod = await import('../backend/index.js')
        expect(mod.eventRouter).toBeNull()
    })

    it('creates overlayBroadcasterService regardless of credentials', async () => {
        const mod = await import('../backend/index.js')
        expect(mod.overlayBroadcasterService).not.toBeNull()
    })
})
