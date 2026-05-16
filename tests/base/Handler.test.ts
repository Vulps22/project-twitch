import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Handler } from '../../backend/src/base/Handler.js'
import type { ITwitchClient, IOverlayBroadcaster, EventConfig } from '../../backend/src/types.js'

const baseConfig: EventConfig = {
    event_name: 'test_event',
    event_type: 'chat_command',
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
        mockTwitchClient = { sendChatMessage: vi.fn().mockResolvedValue(undefined) }
        mockOverlay = { broadcast: vi.fn().mockResolvedValue(undefined) }
        handler = new Handler(mockTwitchClient, mockOverlay)
    })

    it('sends a chat reply when config.reply is set', async () => {
        await handler.executeConfig({ ...baseConfig, reply: 'Hello {{username}}!' }, { username: 'Bob' })
        expect(mockTwitchClient.sendChatMessage).toHaveBeenCalledWith('Hello Bob!')
    })

    it('does not send a chat reply when twitchClient is null', async () => {
        const h = new Handler(null, mockOverlay)
        await h.executeConfig({ ...baseConfig, reply: 'Hello!' }, {})
        expect(mockTwitchClient.sendChatMessage).not.toHaveBeenCalled()
    })

    it('broadcasts an overlay event when config.image is set', async () => {
        await handler.executeConfig({ ...baseConfig, image: 'alert.png' }, {})
        expect(mockOverlay.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            type: 'event',
            event_name: 'test_event',
            image: 'alert.png'
        }))
    })

    it('broadcasts when config.sound is set', async () => {
        await handler.executeConfig({ ...baseConfig, sound: 'alert.mp3' }, {})
        expect(mockOverlay.broadcast).toHaveBeenCalled()
    })

    it('does not broadcast when no media fields are set', async () => {
        await handler.executeConfig({ ...baseConfig, reply: 'hi' }, {})
        expect(mockOverlay.broadcast).not.toHaveBeenCalled()
    })

    it('does not broadcast when overlayBroadcasterService is null', async () => {
        const h = new Handler(mockTwitchClient, null)
        await h.executeConfig({ ...baseConfig, image: 'alert.png' }, {})
        expect(mockOverlay.broadcast).not.toHaveBeenCalled()
    })

    it('processes template tokens in the overlay text field', async () => {
        await handler.executeConfig({ ...baseConfig, image: 'x.png', text: '{{username}} arrived!' }, { username: 'Eve' })
        expect(mockOverlay.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            text: 'Eve arrived!'
        }))
    })
})

describe('Handler.setTwitchClient / setOverlayBroadcasterService', () => {
    it('allows late injection of twitchClient', async () => {
        const handler = new Handler()
        const client: ITwitchClient = { sendChatMessage: vi.fn().mockResolvedValue(undefined) }
        handler.setTwitchClient(client)
        await handler.executeConfig({ ...baseConfig, reply: 'Hi!' }, {})
        expect(client.sendChatMessage).toHaveBeenCalledWith('Hi!')
    })

    it('allows late injection of overlayBroadcasterService', async () => {
        const handler = new Handler()
        const overlay: IOverlayBroadcaster = { broadcast: vi.fn().mockResolvedValue(undefined) }
        handler.setOverlayBroadcasterService(overlay)
        await handler.executeConfig({ ...baseConfig, image: 'x.png' }, {})
        expect(overlay.broadcast).toHaveBeenCalled()
    })
})
