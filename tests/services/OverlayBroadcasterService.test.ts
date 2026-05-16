import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSocket as WsClient } from 'ws'
import { OverlayBroadcasterService } from '../../backend/src/services/OverlayBroadcasterService.js'
import type { OverlayEvent } from '../../backend/src/types.js'

// Suppress Logger output during tests
vi.mock('../../backend/src/utils/Logger.js', () => ({
    default: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
    },
}))

function makeClient(readyState: number) {
    return {
        readyState,
        send: vi.fn(),
    } as unknown as WsClient
}

function makeWss(clients: WsClient[]) {
    return {
        clients: new Set(clients),
    } as unknown as import('ws').WebSocketServer
}

const sampleEvent: OverlayEvent = {
    type: 'event',
    event_name: 'test_event',
}

describe('OverlayBroadcasterService', () => {
    let service: OverlayBroadcasterService

    beforeEach(() => {
        service = new OverlayBroadcasterService()
    })

    describe('broadcast', () => {
        it('returns false when wss is null', async () => {
            const result = await service.broadcast(sampleEvent)
            expect(result).toBe(false)
        })

        it('sends to all OPEN clients and returns true', async () => {
            const clientA = makeClient(WsClient.OPEN)
            const clientB = makeClient(WsClient.OPEN)
            service.setWebSocketServer(makeWss([clientA, clientB]))

            const result = await service.broadcast(sampleEvent)

            expect(result).toBe(true)
            expect(clientA.send).toHaveBeenCalledWith(JSON.stringify(sampleEvent))
            expect(clientB.send).toHaveBeenCalledWith(JSON.stringify(sampleEvent))
        })

        it('skips clients that are not in OPEN state', async () => {
            const openClient = makeClient(WsClient.OPEN)
            const closedClient = makeClient(WsClient.CLOSED)
            const connectingClient = makeClient(WsClient.CONNECTING)
            service.setWebSocketServer(makeWss([openClient, closedClient, connectingClient]))

            const result = await service.broadcast(sampleEvent)

            expect(result).toBe(true)
            expect(openClient.send).toHaveBeenCalledOnce()
            expect(closedClient.send).not.toHaveBeenCalled()
            expect(connectingClient.send).not.toHaveBeenCalled()
        })

        it('returns false when there are no OPEN clients', async () => {
            const closedClient = makeClient(WsClient.CLOSED)
            service.setWebSocketServer(makeWss([closedClient]))

            const result = await service.broadcast(sampleEvent)

            expect(result).toBe(false)
        })

        it('returns false when the client set is empty', async () => {
            service.setWebSocketServer(makeWss([]))

            const result = await service.broadcast(sampleEvent)

            expect(result).toBe(false)
        })

        it('continues sending to other clients if one throws', async () => {
            const faultyClient = makeClient(WsClient.OPEN)
            ;(faultyClient.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
                throw new Error('send failed')
            })
            const goodClient = makeClient(WsClient.OPEN)
            service.setWebSocketServer(makeWss([faultyClient, goodClient]))

            const result = await service.broadcast(sampleEvent)

            expect(goodClient.send).toHaveBeenCalledOnce()
            // faultyClient threw, so sentCount only counts goodClient — still true
            expect(result).toBe(true)
        })
    })

    describe('sendToClient', () => {
        it('sends to an OPEN client and returns true', async () => {
            const client = makeClient(WsClient.OPEN)

            const result = await service.sendToClient(client, sampleEvent)

            expect(result).toBe(true)
            expect(client.send).toHaveBeenCalledWith(JSON.stringify(sampleEvent))
        })

        it('returns false for a non-OPEN client', async () => {
            const client = makeClient(WsClient.CLOSED)

            const result = await service.sendToClient(client, sampleEvent)

            expect(result).toBe(false)
            expect(client.send).not.toHaveBeenCalled()
        })

        it('returns false if send throws', async () => {
            const client = makeClient(WsClient.OPEN)
            ;(client.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
                throw new Error('send error')
            })

            const result = await service.sendToClient(client, sampleEvent)

            expect(result).toBe(false)
        })
    })

    describe('getClientCount', () => {
        it('returns 0 when wss is null', () => {
            expect(service.getClientCount()).toBe(0)
        })

        it('returns count of OPEN clients only', () => {
            const openA = makeClient(WsClient.OPEN)
            const openB = makeClient(WsClient.OPEN)
            const closed = makeClient(WsClient.CLOSED)
            service.setWebSocketServer(makeWss([openA, openB, closed]))

            expect(service.getClientCount()).toBe(2)
        })

        it('returns 0 when no clients are OPEN', () => {
            const closed = makeClient(WsClient.CLOSED)
            service.setWebSocketServer(makeWss([closed]))

            expect(service.getClientCount()).toBe(0)
        })

        it('returns 0 when client set is empty', () => {
            service.setWebSocketServer(makeWss([]))

            expect(service.getClientCount()).toBe(0)
        })
    })
})
