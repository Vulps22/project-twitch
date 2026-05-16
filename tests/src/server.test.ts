import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWss = { on: vi.fn(), clients: new Set() }
const mockServer = { listen: vi.fn() }
const mockApp = { use: vi.fn(), get: vi.fn() }

vi.mock('ws', () => ({
    WebSocketServer: vi.fn(function () { return mockWss })
}))

vi.mock('http', () => ({
    createServer: vi.fn(() => mockServer)
}))

vi.mock('express', () => {
    const app = { use: vi.fn(), get: vi.fn() }
    const fn = vi.fn(() => app) as unknown as typeof import('express').default & { static: ReturnType<typeof vi.fn> }
    fn.static = vi.fn()
    return { default: fn }
})

vi.mock('../../backend/src/utils/Logger.js', () => ({
    default: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('server module', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('exports wss, app, and server', async () => {
        const mod = await import('../../backend/src/server.js')
        expect(mod.wss).toBeDefined()
        expect(mod.app).toBeDefined()
        expect(mod.server).toBeDefined()
    })

    it('starts listening on import', async () => {
        await import('../../backend/src/server.js')
        expect(mockServer.listen).toHaveBeenCalledWith(3001, expect.any(Function))
    })

    it('registers a WebSocket connection handler', async () => {
        await import('../../backend/src/server.js')
        expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function))
    })
})
