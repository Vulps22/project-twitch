import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSocket as WsClient } from 'ws'
import { DashboardBroadcasterService } from '../../backend/src/services/DashboardBroadcasterService.js'
import type { DashboardChatEvent } from '../../backend/src/types.js'

vi.mock('../../backend/src/utils/Logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

function makeClient(readyState: number) {
    return { readyState, send: vi.fn() } as unknown as WsClient
}

function makeWss(clients: WsClient[]) {
    return { clients: new Set(clients) } as unknown as import('ws').WebSocketServer
}

const sampleEvent: DashboardChatEvent = { type: 'chat', userId: 'u1', username: 'Alice' }

describe('DashboardBroadcasterService', () => {
    let service: DashboardBroadcasterService

    beforeEach(() => {
        service = new DashboardBroadcasterService()
    })

    describe('broadcast', () => {
        it('does nothing when wss is null', () => {
            expect(() => service.broadcast(sampleEvent)).not.toThrow()
        })

        it('sends to all OPEN clients', () => {
            const clientA = makeClient(WsClient.OPEN)
            const clientB = makeClient(WsClient.OPEN)
            service.setWebSocketServer(makeWss([clientA, clientB]))

            service.broadcast(sampleEvent)

            expect(clientA.send).toHaveBeenCalledWith(JSON.stringify(sampleEvent))
            expect(clientB.send).toHaveBeenCalledWith(JSON.stringify(sampleEvent))
        })

        it('skips non-OPEN clients', () => {
            const open = makeClient(WsClient.OPEN)
            const closed = makeClient(WsClient.CLOSED)
            service.setWebSocketServer(makeWss([open, closed]))

            service.broadcast(sampleEvent)

            expect(open.send).toHaveBeenCalledOnce()
            expect(closed.send).not.toHaveBeenCalled()
        })

        it('continues to other clients if one throws', () => {
            const faulty = makeClient(WsClient.OPEN)
            ;(faulty.send as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('fail') })
            const good = makeClient(WsClient.OPEN)
            service.setWebSocketServer(makeWss([faulty, good]))

            expect(() => service.broadcast(sampleEvent)).not.toThrow()
            expect(good.send).toHaveBeenCalledOnce()
        })
    })

    describe('getClientCount', () => {
        it('returns 0 when wss is null', () => {
            expect(service.getClientCount()).toBe(0)
        })

        it('counts only OPEN clients', () => {
            const open = makeClient(WsClient.OPEN)
            const closed = makeClient(WsClient.CLOSED)
            service.setWebSocketServer(makeWss([open, closed]))
            expect(service.getClientCount()).toBe(1)
        })

        it('returns 0 when no clients are OPEN', () => {
            service.setWebSocketServer(makeWss([makeClient(WsClient.CLOSED)]))
            expect(service.getClientCount()).toBe(0)
        })
    })
})
