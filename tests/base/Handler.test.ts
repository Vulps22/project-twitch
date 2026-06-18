import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Handler } from '../../backend/src/base/Handler.js'
import type { ITwitchClient, IOverlayBroadcaster, EventConfig } from '../../backend/src/types.js'

vi.mock('../../backend/src/utils/Logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

const baseConfig: EventConfig = {
    event_name: 'test_event',
    event_type: 'chat_command',
    reactions: [],
}

describe('Handler.processTemplate', () => {
    const handler = new Handler()

    it('replaces a single token', () => {
        expect(handler.processTemplate('Hello {{username}}!', { username: 'Alice' })).toBe('Hello Alice!')
    })

    it('replaces multiple tokens', () => {
        expect(handler.processTemplate('{{display_name}} cheered {{count}} bits', {
            display_name: 'Alice',
            count: '100'
        })).toBe('Alice cheered 100 bits')
    })

    it('replaces missing tokens with empty string', () => {
        expect(handler.processTemplate('Hello {{username}}!', {})).toBe('Hello !')
    })

    it('returns empty string for undefined template', () => {
        expect(handler.processTemplate(undefined, {})).toBe('')
    })

    it('returns empty string for empty template', () => {
        expect(handler.processTemplate('', {})).toBe('')
    })

    it('leaves non-template text unchanged', () => {
        expect(handler.processTemplate('no tokens here', { username: 'Alice' })).toBe('no tokens here')
    })
})

describe('Handler.executeConfig', () => {
    let mockTwitchClient: ITwitchClient
    let mockOverlay: IOverlayBroadcaster
    let handler: Handler

    beforeEach(() => {
        mockTwitchClient = { sendChatMessage: vi.fn().mockResolvedValue(true) }
        mockOverlay = { broadcast: vi.fn().mockResolvedValue(true) }
        handler = new Handler(mockTwitchClient, mockOverlay)
    })

    it('sends a chat reply when a chat_reply reaction is present', async () => {
        await handler.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'chat_reply', message: 'Hello {{username}}!' }],
        }, { username: 'Bob' })
        expect(mockTwitchClient.sendChatMessage).toHaveBeenCalledWith('Hello Bob!')
    })

    it('does not send a chat reply when twitchClient is null', async () => {
        const h = new Handler(null, mockOverlay)
        await h.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'chat_reply', message: 'Hello!' }],
        }, {})
        expect(mockTwitchClient.sendChatMessage).not.toHaveBeenCalled()
    })

    it('broadcasts an overlay event when an image reaction is present', async () => {
        await handler.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'image', url: 'alert.png' }],
        }, {})
        expect(mockOverlay.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            type: 'event',
            event_name: 'test_event',
            reactions: expect.arrayContaining([
                expect.objectContaining({ type: 'image', url: 'alert.png' })
            ]),
        }))
    })

    it('broadcasts when a sound reaction is present', async () => {
        await handler.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'sound', filename: 'alert.mp3' }],
        }, {})
        expect(mockOverlay.broadcast).toHaveBeenCalled()
    })

    it('does not broadcast when reactions list is empty', async () => {
        await handler.executeConfig({ ...baseConfig, reactions: [] }, {})
        expect(mockOverlay.broadcast).not.toHaveBeenCalled()
    })

    it('does not broadcast when all reactions are chat_reply', async () => {
        await handler.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'chat_reply', message: 'hi' }],
        }, {})
        expect(mockOverlay.broadcast).not.toHaveBeenCalled()
    })

    it('does not broadcast when overlayBroadcasterService is null', async () => {
        const h = new Handler(mockTwitchClient, null)
        await h.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'image', url: 'alert.png' }],
        }, {})
        expect(mockOverlay.broadcast).not.toHaveBeenCalled()
    })

    it('processes template tokens in the overlay_text reaction', async () => {
        await handler.executeConfig({
            ...baseConfig,
            reactions: [
                { type: 'image', url: 'x.png' },
                { type: 'overlay_text', text: '{{username}} arrived!' },
            ],
        }, { username: 'Eve' })
        expect(mockOverlay.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            reactions: expect.arrayContaining([
                expect.objectContaining({ type: 'overlay_text', text: 'Eve arrived!' }),
            ]),
        }))
    })

    it('broadcasts all non-chat reactions together in one event', async () => {
        await handler.executeConfig({
            ...baseConfig,
            reactions: [
                { type: 'chat_reply', message: 'hi' },
                { type: 'image', url: 'img.png' },
                { type: 'sound', filename: 'snd.mp3' },
            ],
        }, {})
        expect(mockOverlay.broadcast).toHaveBeenCalledTimes(1)
        const call = (mockOverlay.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0]
        expect(call.reactions).toHaveLength(2)
    })
})

describe('Handler.setTwitchClient / setOverlayBroadcasterService', () => {
    it('allows late injection of twitchClient', async () => {
        const handler = new Handler()
        const client: ITwitchClient = { sendChatMessage: vi.fn().mockResolvedValue(true) }
        handler.setTwitchClient(client)
        await handler.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'chat_reply', message: 'Hi!' }],
        }, {})
        expect(client.sendChatMessage).toHaveBeenCalledWith('Hi!')
    })

    it('allows late injection of overlayBroadcasterService', async () => {
        const handler = new Handler()
        const overlay: IOverlayBroadcaster = { broadcast: vi.fn().mockResolvedValue(true) }
        handler.setOverlayBroadcasterService(overlay)
        await handler.executeConfig({
            ...baseConfig,
            reactions: [{ type: 'image', url: 'x.png' }],
        }, {})
        expect(overlay.broadcast).toHaveBeenCalled()
    })
})
